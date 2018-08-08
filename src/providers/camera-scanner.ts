import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions } from '@fttx/barcode-scanner';
import { Promise } from 'bluebird';
import { AlertController } from 'ionic-angular';
import { Observable } from 'rxjs/Observable';

import { ScanModel } from '../models/scan.model';
import { Settings } from './settings';
import { Utils } from './utils';

/*
  Generated class for the CameraScanner provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class CameraScannerProvider {

  constructor(
    private alertCtrl: AlertController,
    private barcodeScanner: BarcodeScanner,
    private settings: Settings,
  ) { }

  scan(continuosMode: boolean = false): Observable<ScanModel> {
    return new Observable(observer => {
      Promise.join(this.settings.getPreferFrontCamera(), this.settings.getEnableLimitBarcodeFormats(), this.settings.getBarcodeFormats(), this.settings.getQuantityEnabled(),
        (preferFrontCamera, enableLimitBarcodeFormats, barcodeFormats, quantyEnabled) => {
          if (preferFrontCamera == null || !preferFrontCamera) preferFrontCamera = false;
          let options: BarcodeScannerOptions = {
            showFlipCameraButton: true, // iOS and Android
            prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
            showTorchButton: true,
            preferFrontCamera: preferFrontCamera,
            continuosMode: continuosMode,
          };

          if (enableLimitBarcodeFormats) {
            options.formats =
              barcodeFormats
                .filter(barcodeFormat => barcodeFormat.enabled)
                .map(barcodeFormat => barcodeFormat.name)
                .join(',');
          }

          console.log('scanning with formats: ', options.formats)

          this.barcodeScanner.scan(options).subscribe((scan: ScanModel) => {
            if (scan.cancelled) {
              observer.error();
            }

            if (scan && scan.text) {
              if (scan.format == 'CODE_39' && barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
                scan.text = Utils.convertCode39ToCode32(scan.text);
              }
              let now = new Date().getTime();
              scan.id = now;
              scan.repeated = false;
              scan.date = now;

              console.log('quantyEnabled:', quantyEnabled)
              if (quantyEnabled) {
                this.alertCtrl.create({
                  title: 'Enter quantity value',
                  // message: 'Inse',
                  inputs: [{
                    name: 'quantity',
                    placeholder: 'Eg. 5'
                  }],
                  buttons: [{
                    text: 'Ok',
                    handler: data => {
                      if (data.quantity) { // && isNumber(data.quantity)
                        scan.quantity = data.quantity;
                      }
                      observer.next(scan);
                    }
                  }]
                }).present();
              } else {
                observer.next(scan);
              }
            }
          }, (err) => {
            observer.error(err)
          });
        });

    });
    // let s = new ScanModel();
    // let id = new Date().getMilliseconds();
    // s.cancelled = false;
    // s.id = id;
    // s.text = 'random scan: ' + id
    // resolve(s)
  }
}
