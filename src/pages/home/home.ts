import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { BarcodeScanner } from 'ionic-native';
import { NavController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanPage } from '../scan/scan'
import { WebSocketProvider } from '../../providers/websocket'
import { Config } from '../../providers/config'
declare var cordova: any;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  private webSocketProvider: WebSocketProvider;

  public connected = false;
  public scanSessions: ScanSessionModel[] = [{
    name: 'Scan 1',
    date: new Date(),
    scannings: [{
      text: '011011010110',
      format: 'ean boh'
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

  onItemSelected(scan) {
    this.navCtrl.push(ScanPage);
  }

  onAddClick() {/*
    BarcodeScanner.scan().then((barcodeData) => {
      this.scannings.push({
        name: 'Scan x',
        date: new Date(),
        scannings: barcodeData
      });
    }, (err) => { });*/

    let newScan = {
      text: 'd6a54d85aw4d5as4d',
      format: 'ean'
    };
    let newScanSession = {
      name: 'Scan n. ' + (+this.scanSessions.length + 1),
      date: new Date(),
      scannings: [newScan]
    };
    this.scanSessions.push(newScanSession);
    this.webSocketProvider.send(newScan);
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
