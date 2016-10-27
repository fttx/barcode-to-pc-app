import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { BarcodeScanner } from 'ionic-native';
import { NavController } from 'ionic-angular';
import { AlertController } from 'ionic-angular';
import { Alert } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'
import { Config } from '../../providers/config'
import { SecureStorage } from 'ionic-native'

declare var cordova: any;

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html'
})
export class ScanSessionsPage {
  public connected = false;
  public scanSessions: ScanSessionModel[] = [{
    name: 'Scan session 1',
    date: new Date(),
    scannings: [{
      text: '011011010110',
      format: 'ean'
    }, {
      text: 'Das4da45sd54a54SAD',
      format: 'iso'
    }, {
      text: '101541654541',
      format: 'ean_v2'
    }, {
      text: 'AAABBBCCDD',
      format: 'ean r'
    }]
  }];

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    platform: Platform
  ) {
    platform.ready().then(() => {
      serverProvider.getDefaultServer().then(
        server => {this.serverProvider.connect(server); console.log("default server found: ", server)},
        err => this.navCtrl.push(SelectServerPage)
      )
    });
  }

  onSelectServerClick() {
    this.navCtrl.push(SelectServerPage);
  }

  onItemSelected(scanSession) {
    this.navCtrl.push(ScanSessionPage, { scanSession: scanSession });
  }

  onAddClick() {
    // spostare tutto dentro un provider e cambiare pagina a ScanSession prima di fare partire la fotocamera
    BarcodeScanner.scan({
      "showFlipCameraButton": true, // iOS and Android
      "prompt": "Place a barcode inside the scan area", // supported on Android only
      "orientation": "landscape" // Android only (portrait|landscape), default unset so it rotates with the device
    }).then((barcodeData) => {
      if (barcodeData && barcodeData.text) {
        let newScanSession = {
          name: 'Scan x',
          date: new Date(),
          scannings: [barcodeData]
        };
        this.scanSessions.push(newScanSession);
        this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, askAddMore: true });
        this.serverProvider.send(barcodeData);
      }
    }, (err) => {
      if (Config.DEBUG) {
        let newScan = { text: 'd6a54d85aw4d5as4d', format: 'ean' };
        let newScanSession = {
          name: 'Scan session n. ' + (+this.scanSessions.length + 1),
          date: new Date(),
          scannings: [newScan]
        };
        this.scanSessions.push(newScanSession);
        this.serverProvider.send(newScan);
      } else {
        // TODO: alternativo
      }
    });
  }
  /*
    connect() {
      this.webSocketProvider = ServerProvider.connect();
      this.webSocketProvider.observable.subscribe(
        (message) => { // onmessage + onopen
          this.connected = true;
          console.log('on message', message);
        }, (error) => { // on error
          this.connected = false;
          console.log('on error', error);
          this.navCtrl.push(SelectServerPage);
        });
    }*/

}
