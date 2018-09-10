import { Injectable, NgZone } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions } from '@fttx/barcode-scanner';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { Promise } from 'bluebird';
import { AlertController, Platform } from 'ionic-angular';
import { Subscriber } from 'rxjs';
import { Observable } from 'rxjs/Observable';

import { ScanModel } from '../models/scan.model';
import { Config } from './config';
import { Settings } from './settings';
import { Utils } from './utils';

/*
  Generated class for the CameraScanner provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class CameraScannerProvider {
  private observer: Subscriber<ScanModel>;
  private continuousMode: boolean;
  private pluginOptions: BarcodeScannerOptions
  private barcodeFormats;
  private quantyEnabled: boolean;
  private quantityType;

  constructor(
    private alertCtrl: AlertController,
    private barcodeScanner: BarcodeScanner,
    private platform: Platform,
    private ngZone: NgZone,
    private ga: GoogleAnalytics,
    private settings: Settings,
  ) { }

  scan(continuousMode: boolean = false): Observable<ScanModel> {
    this.continuousMode = continuousMode;
    return new Observable(observer => {
      this.observer = observer;
      Promise.join(this.settings.getPreferFrontCamera(), this.settings.getEnableLimitBarcodeFormats(), this.settings.getBarcodeFormats(), this.settings.getQuantityEnabled(), this.settings.getQuantityType(),
        (preferFrontCamera, enableLimitBarcodeFormats, barcodeFormats, quantyEnabled, quantityType) => {
          if (preferFrontCamera == null || !preferFrontCamera) preferFrontCamera = false;

          let pluginContinuousMode = continuousMode; // if there is a quantity, the continuos mode is disabled to allow the webview to insert a value
          if (quantyEnabled || !this.platform.is('android')) {
            pluginContinuousMode = false;
          }

          let pluginOptions: BarcodeScannerOptions = {
            showFlipCameraButton: true,
            prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
            showTorchButton: true,
            preferFrontCamera: preferFrontCamera,
            continuousMode: pluginContinuousMode,
          };

          if (enableLimitBarcodeFormats) {
            pluginOptions.formats =
              barcodeFormats
                .filter(barcodeFormat => barcodeFormat.enabled)
                .map(barcodeFormat => barcodeFormat.name)
                .join(',');
          }

          console.log('scanning with formats: ', pluginOptions.formats)
          this.barcodeFormats = barcodeFormats;
          this.quantyEnabled = quantyEnabled;
          this.quantityType = quantityType;
          this.pluginOptions = pluginOptions;
          this.pluginScan();
        });
    });
  }

  private pluginScan() {
    this.barcodeScanner.scan(this.pluginOptions).subscribe((scan: ScanModel) => { // maybe should call .unsubscribe
      if (!scan) {
        return;
      }

      if (scan.cancelled) {
        this.observer.complete();
        console.log('@@@@complete')
        return;
      }

      if (scan.text && scan.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
        scan.text = Utils.convertCode39ToCode32(scan.text);
      }
      let now = new Date().getTime();
      scan.id = now;
      scan.repeated = false;
      scan.date = now;

      if (this.quantyEnabled) {
        this.alertCtrl.create({
          title: 'Enter quantity value',
          // message: 'Inse',
          enableBackdropDismiss: false,
          inputs: [{
            name: 'quantity',
            type: this.quantityType || 'number',
            placeholder: 'Eg. 5'
          }],
          buttons: [{
            text: 'Ok',
            handler: data => {
              if (data.quantity) { // && isNumber(data.quantity)
                scan.quantity = data.quantity;
              }
              this.nextScan(scan)
            }
          }, {
            role: 'cancel',
            text: ' Cancel',
            handler: () => {
              this.observer.complete();
            }
          }]
        }).present();
      } else {
        this.nextScan(scan)
      }
    }, (err) => {
      console.log('@plugin err: ', err)
      this.observer.error(err)
    });
  }

  private nextScan(scan) {
    this.observer.next(scan);

    if (this.quantyEnabled) { // if the quantity is enabled
      // do the following for both ios and android:
      if (this.continuousMode) {
        this.showAddMoreDialog();
      } else {
        this.observer.complete();
        console.log('@@@@complete')
      }
    } else {
      if (this.platform.is('android')) {
        if (!this.continuousMode) {
          this.observer.complete();
        }
        console.log('@@@@complete')
      } else {
        if (this.continuousMode) {
          this.showAddMoreDialog();
        } else {
          this.observer.complete();
          console.log('@@@@complete')
        }
      }
    }

    // this function can be shorter, but this way is more readable
  }

  showAddMoreDialog() {
    let interval = null;

    let alert = this.alertCtrl.create({
      title: 'Continue scanning?',
      message: 'Do you want to add another item to this scan session?',
      buttons: [{
        text: 'Stop',
        role: 'cancel',
        handler: () => {
          if (interval) clearInterval(interval);
          this.observer.complete();
        }
      }, {
        text: 'Continue',
        handler: () => {
          if (interval) clearInterval(interval);
          this.pluginScan();
        }
      }]
    });
    alert.present();

    this.settings.getContinueModeTimeout().then(timeoutSeconds => {
      if (timeoutSeconds == null) {
        timeoutSeconds = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
      } else {
        this.ga.trackEvent('scannings', 'custom_timeout', null, timeoutSeconds);
      }

      interval = setInterval(() => {
        this.ngZone.run(() => {
          alert.setSubTitle('Timeout: ' + timeoutSeconds);
        })
        if (timeoutSeconds == 0) {
          if (interval) clearInterval(interval);
          alert.dismiss();
          this.pluginScan();
        }
        timeoutSeconds--;
      }, 1000);
    });
  }
}
