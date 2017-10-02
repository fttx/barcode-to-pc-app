import { Injectable } from '@angular/core';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { ScanModel } from '../models/scan.model'
import { Settings } from './settings'

/*
  Generated class for the CameraScanner provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class CameraScannerProvider {

  constructor(
    private barcodeScanner: BarcodeScanner,
    private settings: Settings,
  ) { }

  scan(): Promise<ScanModel> {

    return new Promise((resolve, reject) => {
      // let s = new ScanModel();
      // let id = new Date().getMilliseconds();
      // s.cancelled = false;
      // s.id = id;
      // s.text = 'random scan: ' + id
      // resolve(s)


      this.settings.getPreferFrontCamera().then(preferFrontCamera => {
        this.barcodeScanner.scan({
          showFlipCameraButton: true, // iOS and Android
          prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
          showTorchButton: true,
          preferFrontCamera: preferFrontCamera
        }).then((scan: ScanModel) => {
          if (scan.cancelled) {
            reject();
          }

          if (scan && scan.text) {
            scan.id = new Date().getTime();
            scan.repeated = false;
            resolve(scan);
          }
        }, (err) => {
          reject(err)
        });
      });
    });
  } // scan
}
