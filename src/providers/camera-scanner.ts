import { Injectable } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions } from '@fttx/barcode-scanner';
import { ScanModel } from '../models/scan.model'
import { Settings } from './settings'
import { Observable } from 'rxjs/Observable';
import { barcodeFormatModel } from '../models/barcode-format.model';

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

  scan(continuosMode: boolean = false): Observable<ScanModel> {
    return new Observable(observer => {
      Promise.all([
        this.settings.getPreferFrontCamera(),
        this.settings.getEnableLimitBarcodeFormats(),
        this.settings.getBarcodeFormats()
      ]).then((results) => {
        let preferFrontCamera = results[0];
        let enableLimitBarcodeFormats = results[1];
        let barcodeFormats = results[2];

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
            let now = new Date().getTime();
            scan.id = now;
            scan.repeated = false;
            scan.date = now;
            observer.next(scan);
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
