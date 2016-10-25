import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { BarcodeScanner } from 'ionic-native';
import { NavController } from 'ionic-angular';
import { ScanModel } from '../../models/scan.model'
import { ScanPage } from '../scan/scan'
import { WebSocketProvider } from '../../providers/websocket'
import { Config } from '../../providers/config'
declare var cordova: any;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  public scannings: ScanModel[] = [{
    name: 'Scan 1',
    date: new Date(),
    data: [{
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
            this.connect(service.addresses[0]);
          }
        });
      });
    } else {
      this.connect('ws://localhost:' + Config.SERVER_PORT + '/');
    }
  }

  onOpen() {

  }

  onError() {

  }

  onMessage(message) {
    console.log(message.data);
  }

  onItemSelected(scan) {
    this.navCtrl.push(ScanPage);
  }

  onAddClick() {
    BarcodeScanner.scan().then((barcodeData) => {
      this.scannings.push({
        name: 'Scan x',
        date: new Date(),
        data: barcodeData
      });
    }, (err) => { });
  }

  private connect(address) {
    new WebSocketProvider(address).onMessage().subscribe(this.onMessage);
    new WebSocketProvider(address).onError().subscribe(this.onError);
    new WebSocketProvider(address).onOpen().subscribe(this.onOpen);
  }
}
