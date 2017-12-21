import { Injectable } from '@angular/core';
import { BarcodeScanner } from '@fttx/barcode-scanner';
import { ScanModel } from '../models/scan.model'
import { Settings } from './settings'
import { Observable } from 'rxjs/Observable';

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
      this.settings.getPreferFrontCamera().then(preferFrontCamera => {
        if (preferFrontCamera == null || !preferFrontCamera) preferFrontCamera = false;
        this.barcodeScanner.scan({
          showFlipCameraButton: true, // iOS and Android
          prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
          showTorchButton: true,
          preferFrontCamera: preferFrontCamera,
          continuosMode: continuosMode
        }).subscribe((scan: ScanModel) => {
          if (scan.cancelled) {
            observer.error();
          }

          if (scan && scan.text) {
            scan.id = new Date().getTime();
            scan.repeated = false;
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
