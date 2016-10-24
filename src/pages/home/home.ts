import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { BarcodeScanner } from 'ionic-native';
import { NavController } from 'ionic-angular';
import { ScanModel } from '../../models/scan.model'
import { ScanPage } from '../scan/scan'

declare var cordova: any;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  public scannings: ScanModel[];

  public count = 0;
  constructor(public navCtrl: NavController, platform: Platform) {
    this.scannings = [{
      name: 'Scan 1',
      date: new Date(),
      data: [{
        text: '011011010110',
        format: 'ean boh'
      }]
    }];

   platform.ready().then(() => {
      if (typeof cordova != typeof undefined) {
        this.count++;
        cordova.plugins.zeroconf.watch('_http._tcp.local.', function (result) {
          var action = result.action;
          var service = result.service;
          if (action == 'added') {
            console.log('service added', service);
          } else {
            console.log('service removed', service);
          }
        });
      }
    });
  }

  itemSelected(scan) {
    this.navCtrl.push(ScanPage);
  }

  add() {
    BarcodeScanner.scan().then((barcodeData) => {
      this.scannings.push({
        name: 'Scan x',
        date: new Date(),
        data: barcodeData
      });
    }, (err) => {
      // An error occurred
    });
  }
}
