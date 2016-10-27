import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { BarcodeScanner } from 'ionic-native';
import { NavController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { WebSocketProvider } from '../../providers/websocket'
import { Config } from '../../providers/config'

declare var cordova: any;

@Component({
  selector: 'page-scannings',
  templateUrl: 'scannings.html'
})
export class ScanningsPage {
  private webSocketProvider: WebSocketProvider;

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

  constructor(public navCtrl: NavController, platform: Platform) {
    if (typeof cordova != typeof undefined) {
      platform.ready().then(() => {
        cordova.plugins.zeroconf.watch('_http._tcp.local.', (result) => {
          var action = result.action;
          var service = result.service;
          if (action == 'added' && service.port == Config.SERVER_PORT && service.addresses) {
            this.connect('ws://' + service.addresses[0] + ':' + Config.SERVER_PORT + '/');
          }
        });
      });
    } else {
      this.connect('ws://localhost:' + Config.SERVER_PORT + '/');
    }
  }

  onItemSelected(scanSession) {
    this.navCtrl.push(ScanSessionPage, { scanSession: scanSession });
  }

  onAddClick() {
    // spostare tutto dentro un provider e cambiare pagina a ScanSession prima di fare partire la fotocamera
    BarcodeScanner.scan({
      "showFlipCameraButton": true, // iOS and Android
      "prompt": "Place a barcode inside the scan area", // supported on Android only
      //"orientation": "landscape" // Android only (portrait|landscape), default unset so it rotates with the device
    }).then((barcodeData) => {
      if (barcodeData && barcodeData.text) {
        let newScanSession = {
          name: 'Scan x',
          date: new Date(),
          scannings: [barcodeData]
        };
        this.scanSessions.push(newScanSession);
        this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, askAddMore: true });
        this.webSocketProvider.send(barcodeData);
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
        this.webSocketProvider.send(newScan);
      } else {
        // TODO: alternativo
      }
    });
  }

  private connect(address) {
    this.webSocketProvider = new WebSocketProvider(address);
    this.webSocketProvider.observable.subscribe(
      (message) => { // onmessage + onopen
        this.connected = true;
        console.log('on message', message);
      }, (error) => { // on error
        this.connected = false;
        console.log('on error', error);
      });
  }
}
