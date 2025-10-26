/*
* Copyright (C) 2018 Zebra Technologies Corp
* All rights reserved.
*/

import { Injectable } from '@angular/core';
import { WebIntent } from '@ionic-native/web-intent';
import { Events } from 'ionic-angular';
import { Platform } from 'ionic-angular';

@Injectable()
export class ZebraProvider {

  private requestResultCodes = "false";

  constructor(
    public events: Events,
    private platform: Platform,
    private webIntent: WebIntent
  ) {

  }

  close() {
    this.webIntent.unregisterBroadcastReceiver();
  }

  init(actions: string[] = []) {
    this.close();
    this.platform.ready().then((readySource) => {
      const constructorInstance = this;
      //  The Datawedge service will respond via implicit broadcasts intents.
      //  Responses may be the result of calling the Datawedge API or may be because a barcode was scanned
      //  Set up a broadcast receiver to listen for incoming scans
      this.webIntent.registerBroadcastReceiver({
        filterActions: [
          ...actions,                                       //  Response from scan (needs to match value in output plugin)
          'com.symbol.datawedge.api.RESULT_ACTION',        //  Response from DataWedge service (as defined by API)
          'com.symbol.datawedge.api.NOTIFICATION_ACTION',  //  Notification from DataWedge service
          'com.symbol.datawedge.api.ACTION'                //  General DataWedge API action
        ],
        filterCategories: [
          'android.intent.category.DEFAULT'
        ]
      },
      ).subscribe(intent => {
        //  Broadcast received
        console.log('[Zebra] Received Intent: ' + JSON.stringify(intent));
        console.log('[Zebra] Intent Action: ' + (intent ? intent.action : 'no action'));
        console.log('[Zebra] Intent Extras: ', intent.extras);

        //  Emit a separate event for the result associated with this scan.  This will only be present in response to
        //  API calls which included a SEND_RESULT extra
        if (intent.extras.hasOwnProperty('RESULT_INFO')) {
          const commandResult = intent.extras.RESULT + " (" +
            intent.extras.COMMAND.substring(intent.extras.COMMAND.lastIndexOf('.') + 1, intent.extras.COMMAND.length) + ")";  // + JSON.stringify(intent.extras.RESULT_INFO);
          constructorInstance.events.publish('data:commandResult', commandResult.toLowerCase());
        }

        if (intent.extras.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_VERSION_INFO')) {
          //  The version has been returned (DW 6.3 or higher).  Includes the DW version along with other subsystem versions e.g MX
          const versionInfo = intent.extras['com.symbol.datawedge.api.RESULT_GET_VERSION_INFO'];
          console.log('[Zebra] Version Info: ', versionInfo);
          constructorInstance.events.publish('status:version', versionInfo);
          const datawedgeVersion = versionInfo['DATAWEDGE'];
          console.log("[Zebra] Datawedge version: " + datawedgeVersion);

          //  Fire events sequentially so the application can gracefully degrade the functionality available on earlier DW versions
          if (datawedgeVersion >= "6.3")
            constructorInstance.events.publish('status:dw63ApisAvailable', true);
          if (datawedgeVersion >= "6.4")
            constructorInstance.events.publish('status:dw64ApisAvailable', true);
          if (datawedgeVersion >= "6.5")
            constructorInstance.events.publish('status:dw65ApisAvailable', true);
        }
        else if (intent.extras.hasOwnProperty('com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS')) {
          //  Return from our request to enumerate the available scanners
          let enumeratedScanners = intent.extras['com.symbol.datawedge.api.RESULT_ENUMERATE_SCANNERS'];
          constructorInstance.events.publish('data:enumeratedScanners', enumeratedScanners);
        }
        else if (intent.extras.hasOwnProperty('com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE')) {
          //  Return from our request to obtain the active profile
          let activeProfile = intent.extras['com.symbol.datawedge.api.RESULT_GET_ACTIVE_PROFILE'];
          constructorInstance.events.publish('data:activeProfile', activeProfile);
        }
        else if (!intent.extras.hasOwnProperty('RESULT_INFO')) {
          //  A barcode has been scanned
          constructorInstance.events.publish('data:scan', intent, new Date().toLocaleTimeString());
        }
      },
        error => {
          console.error('[Zebra] Error in broadcast receiver subscription: ', error);
        }
      );

    });
  }

  //  Control whether or not to include the SEND_RESULT extra in our commands to request DW send the
  //  result back to us.  Only available in DW6.5+
  requestResult(requestCodes: boolean) {
    this.requestResultCodes = "" + requestCodes;
  }

  //  Send a broadcast intent to the DW service which is present on all Zebra devcies.
  //  This functionality requires DW6.3+ as that is the version where the com.symbol.datawedge.api.ACTION
  //  was introduced.
  //  extraValue may be a String or a Bundle
  sendCommand(extraName: string, extraValue) {
    console.log("[Zebra] Sending Command: " + extraName + ", ", extraValue);
    this.webIntent.sendBroadcast({
      action: 'com.symbol.datawedge.api.ACTION',
      extras: {
        [extraName]: extraValue,
        "SEND_RESULT": this.requestResultCodes
      }
    }).then(() => {
      //  Success in sending the intent, not success of DW to process the intent.
    }).catch((error) => {
      //  Failure in sending the intent, not failure of DW to process the intent.
      console.log("[Zebra] Error sending broadcast: ", error);
    });
  }

  requestVersion() {
    this.sendCommand("com.symbol.datawedge.api.GET_VERSION_INFO", "");
  }

}
