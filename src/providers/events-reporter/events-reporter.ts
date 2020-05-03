import { Injectable } from '@angular/core';
import { BatteryStatus } from '@ionic-native/battery-status';
import { Subscription } from 'rxjs';
import { requestModelOnSmartphoneCharge } from '../../models/request.model';
import { responseModel, responseModelUpdateSettings } from '../../models/response.model';
import { ServerProvider } from '../server';
import { Settings } from '../settings';

/**
 * This provider is called once on the main app.component.ts file, and then it
 * takes care of interfacing with other providers or pages to detect the Events
 * that the server needs.
 *
 * Eg. When the user enables onSmartPhoneCharge event from the server settings
 * we start listening for the battery status, and report the event to the server
 */
@Injectable()
export class EventsReporterProvider {
  private batteryStatusSubscription: Subscription = null;
  private previousBatteryStatus: boolean = null;

  constructor(
    private settings: Settings,
    private batteryStatus: BatteryStatus,
    private serverProvider: ServerProvider,
  ) { }

  /**
   * Called from the app.component.ts
   */
  public init() {

    // onSmartPhoneCharge
    // We won't need to unsubscribe to the onConnect/onDisconnect events since
    // there is only one instance of the EventsReporterProvider.
    this.serverProvider.onConnect().subscribe(() => {
      this.updateBatteryReporting();
    });
    this.serverProvider.onDisconnect().subscribe(() => {
      this.updateBatteryReporting();
    })
    this.serverProvider.onMessage().subscribe(async (messageData: any) => {
      if (messageData.action == responseModel.ACTION_UPDATE_SETTINGS) {
        let response: responseModelUpdateSettings = messageData;
        let eventOnSmartphoneChargeEnabled = response.events.findIndex(x => x == responseModel.EVENT_ON_SMARTPHONE_CHARGE) != -1;
        await this.settings.setEventsOnSmartphoneChargeEnabled(eventOnSmartphoneChargeEnabled);
        this.updateBatteryReporting();
      }
    });
  }

  private async updateBatteryReporting() {
    if (this.serverProvider.isConnected() && await this.settings.getEventsOnSmartphoneChargeEnabled()) {
      if (this.batteryStatusSubscription != null) this.batteryStatusSubscription.unsubscribe()
      this.batteryStatusSubscription = this.batteryStatus.onChange().subscribe(status => {
        if (status.isPlugged && this.previousBatteryStatus != null && this.previousBatteryStatus != status.isPlugged) {
          let wsRequest = new requestModelOnSmartphoneCharge().fromObject({});
          this.serverProvider.send(wsRequest);
        }
        this.previousBatteryStatus = status.isPlugged;
      });
    } else { // not connected or event reporting disabled
      if (this.batteryStatusSubscription != null) {
        this.batteryStatusSubscription.unsubscribe();
        this.batteryStatusSubscription = null;
      }
    }
  }

}
