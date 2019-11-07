import { Injectable } from '@angular/core';
import { Device } from '@ionic-native/device';
import { Network } from '@ionic-native/network';
import { AlertController } from 'ionic-angular';
import 'rxjs/add/operator/map';
import { barcodeFormatModel } from '../models/barcode-format.model';



/*
  Generated class for the Utils provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Utils {
  private enableWifiShown = false;

  constructor(
    private network: Network,
    private alertCtrl: AlertController,
    private device: Device,
  ) { }

  public static getUrlParameterValue(url, parameterName) {
    parameterName = parameterName.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + parameterName + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }

  public updateBarcodeFormats(savedBarcodeFormats) {
    let supportedBarcodeFormats = barcodeFormatModel.supportedBarcodeFormats;
    let addedBarcodeFormats: barcodeFormatModel[] = [];
    let removedBarcodeFormats: barcodeFormatModel[] = [];

    supportedBarcodeFormats.forEach((supportedBarcodeFormat: barcodeFormatModel) => {
      if (savedBarcodeFormats.findIndex(x => x.equals(supportedBarcodeFormat)) == -1) { // if the saved list doesn't contain a supported barcode format
        addedBarcodeFormats.push(supportedBarcodeFormat);
      }
    })

    savedBarcodeFormats.forEach(savedBarcodeFormat => {
      if (supportedBarcodeFormats.findIndex(x => x.equals(savedBarcodeFormat)) == -1) { // if the saved list doesn't contain a supported barcode format
        removedBarcodeFormats.push(savedBarcodeFormat);
      }
    })
    // console.log('update detected, changes:')
    // console.log('==========================================')
    // console.log('-----', removedBarcodeFormats)
    // console.log('+++++', addedBarcodeFormats);
    // console.log('==========================================')
    // console.log('old:', savedBarcodeFormats);
    // console.log('new:', savedBarcodeFormats.filter(x => removedBarcodeFormats.findIndex(y => x.equals(y)) == -1).concat(addedBarcodeFormats))
    return savedBarcodeFormats.filter(x => removedBarcodeFormats.findIndex(y => x.equals(y)) == -1).concat(addedBarcodeFormats)
  }

  public isAndroid() {
    return (this.device.platform || 'unknown').toLowerCase().indexOf('android') != -1;
  }

  // view-source:http://www.reminformatica.it/joomla/code32.html
  // not my stuff :O=
  public static convertCode39ToCode32(code39) {
    var result = '';
    var XP = code39
    if (XP.length != "6") {
      console.log('Invalid code32, fallback to code39')
      return code39;
    }
    let x1 = XP.substring(0, 1)
    let x2 = XP.substring(1, 2)
    let x3 = XP.substring(2, 3)
    let x4 = XP.substring(3, 4)
    let x5 = XP.substring(4, 5)
    let x6 = XP.substring(5, 6)

    let a_1 = 33554432
    let a_2 = 1048576
    let a_3 = 32768
    let a_4 = 1024
    let a_5 = 32
    let a_6 = 1

    var a_1_1a = x1
    let ab = a_1_1a
    var ab1 = ""
    quor()
    var a_1_1 = ab1

    var a_1_2a = x2
    ab = a_1_2a
    ab1 = ""
    quor()
    var a_1_2 = ab1

    var a_1_3a = x3
    ab = a_1_3a
    ab1 = ""
    quor()
    var a_1_3 = ab1

    var a_1_4a = x4
    ab = a_1_4a
    ab1 = ""
    quor()
    var a_1_4 = ab1

    var a_1_5a = x5
    ab = a_1_5a
    ab1 = ""
    quor()
    var a_1_5 = ab1

    var a_1_6a = x6
    ab = a_1_6a
    ab1 = ""
    quor()
    var a_1_6 = ab1

    var P1 = parseInt(a_1_1) * a_1
    var P2 = parseInt(a_1_2) * a_2
    var P3 = parseInt(a_1_3) * a_3
    var P4 = parseInt(a_1_4) * a_4
    var P5 = parseInt(a_1_5) * a_5
    var P6 = parseInt(a_1_6) * a_6

    var P7 = P1 + P2 + P3 + P4 + P5 + P6

    function quor() {
      if (ab == "0") {
        ab = 0
      }
      if (ab == "1") {
        ab = 1
      }
      if (ab == "2") {
        ab = 2
      }
      if (ab == "3") {
        ab = 3
      }
      if (ab == "4") {
        ab = 4
      }
      if (ab == "5") {
        ab = 5
      }
      if (ab == "6") {
        ab = 6
      }
      if (ab == "7") {
        ab = 7
      }
      if (ab == "8") {
        ab = 8
      }
      if (ab == "9") {
        ab = 9
      }
      if (ab == "B") {
        ab = 10
      }
      if (ab == "C") {
        ab = 11
      }
      if (ab == "D") {
        ab = 12
      }
      if (ab == "F") {
        ab = 13
      }
      if (ab == "G") {
        ab = 14
      }
      if (ab == "H") {
        ab = 15
      }
      if (ab == "J") {
        ab = 16
      }
      if (ab == "K") {
        ab = 17
      }
      if (ab == "L") {
        ab = 18
      }
      if (ab == "M") {
        ab = 19
      }
      if (ab == "N") {
        ab = 20
      }
      if (ab == "P") {
        ab = 21
      }
      if (ab == "Q") {
        ab = 22
      }
      if (ab == "R") {
        ab = 23
      }
      if (ab == "S") {
        ab = 24
      }
      if (ab == "T") {
        ab = 25
      }
      if (ab == "U") {
        ab = 26
      }
      if (ab == "V") {
        ab = 27
      }
      if (ab == "W") {
        ab = 28
      }
      if (ab == "X") {
        ab = 29
      }
      if (ab == "Y") {
        ab = 30
      }
      if (ab == "Z") {
        ab = 31
      }
      ab1 = ab
      return ab1
    }

    let P8 = "A" + P7
    if (P8.length == 10) {
      result = P8.substring(1, 9)
    }
    if (P8.length == 9) {
      result = P8.substring(1, 8)
    }
    if (P8.length == 8) {
      result = P8.substring(1, 7)
    }
    if (P8.length == 7) {
      result = P8.substring(1, 6)
    }
    if (P8.length == 6) {
      result = P8.substring(1, 5)
    }
    if (P8.length == 5) {
      result = P8.substring(1, 4)
    }
    if (P8.length == 4) {
      result = P8.substring(1, 3)
    }
    if (P8.length == 3) {
      result = P8.substring(1, 2)
    }
    if (P8.length == 2) {
      result = P8.substring(1, 1)
    }
    if (P8.length == 1) {
      result = "0"
    }
    code39 = XP
    if (result.length == 7) {
      result = "0" + result
    }
    if (result.length == 6) {
      result = "00" + result
    }
    if (result.length == 5) {
      result = "000" + result
    }
    if (result.length == 4) {
      result = "0000" + result
    }
    if (result.length == 3) {
      result = "00000" + result
    }
    if (result.length == 2) {
      result = "000000" + result
    }
    if (result.length == 1) {
      result = "0000000" + result
    }

    result = 'A' + result;


    // compute the 9th character (check digit)
    // https://www.free-barcode-generator.net/code-32/
    let z1 = 2 * parseInt(result[2]);
    let z2 = 2 * parseInt(result[4]);
    let z3 = 2 * parseInt(result[6]);
    let z4 = 2 * parseInt(result[8]);
    let S1 = Math.trunc(z1 / 10) + Math.trunc(z2 / 10) + Math.trunc(z3 / 10) + Math.trunc(z4 / 10) + z1 % 10 + z2 % 10 + z3 % 10 + z4 % 10;
    let S2 = parseInt(result[1]) + parseInt(result[3]) + parseInt(result[5]) + parseInt(result[7]);
    let S = S1 + S2;
    result += ("" + S % 10);

    // checksum:
    // XP2 = XP
    // base32()
    // XP3 = code39
    // if (XP3 != XP2) {
    //     console.log('Invalid code32, fallback to code39')
    //     return code39;
    // }
    return result;
  }

  showCannotPerformActionOffline() {
    this.alertCtrl.create({
      title: 'Cannot perform this action while offline',
      message: 'Please connect the app to the server',
      buttons: [{
        text: 'Ok', role: 'cancel'
      }]
    }).present();
  }

  showEnableWifiDialog() {
    if (this.network.type != 'ethernet' && this.network.type != 'wifi' && !this.enableWifiShown) {
      this.alertCtrl.create({
        title: 'Wi-Fi is disabled',
        message: 'Please connect your smartphone to a Wi-Fi network (or ethernet)',
        buttons: [
          {
            text: 'Ok',
            handler: () => { }
          }
        ]
      }).present();
      this.enableWifiShown = true;
    }
  }
}
