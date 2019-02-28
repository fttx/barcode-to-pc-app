import { Injectable, NgZone } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions } from '@fttx/barcode-scanner';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
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
  public isQuantityDialogOpen = false;

  private observer: Subscriber<ScanModel>;
  private continuousMode: boolean;
  private pluginOptions: BarcodeScannerOptions
  private barcodeFormats;
  private quantyEnabled: boolean;
  private quantityType;
  private continueModeTimeout: number;

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
      Promise.all([this.settings.getPreferFrontCamera(), this.settings.getEnableLimitBarcodeFormats(), this.settings.getBarcodeFormats(), this.settings.getQuantityEnabled(), this.settings.getQuantityType(), this.settings.getContinueModeTimeout()]).then(
        result => {
          let preferFrontCamera = result[0];
          let enableLimitBarcodeFormats = result[1];
          let barcodeFormats = result[2];
          let quantyEnabled = result[3];
          let quantityType = result[4];
          let continueModeTimeout = result[5];
          
          if (preferFrontCamera == null || !preferFrontCamera) preferFrontCamera = false;

          let pluginContinuousMode = continuousMode; // if there is a quantity, the continuos mode is disabled to allow the webview to insert a value
          if (quantyEnabled || !this.platform.is('android') || continueModeTimeout) { // this condition must be reflected inside this.nextScan() method in order to reopen the camera when it's in continuos mode+dialog
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

          this.barcodeFormats = barcodeFormats;
          this.quantyEnabled = quantyEnabled;
          this.quantityType = quantityType;
          this.pluginOptions = pluginOptions;
          this.continueModeTimeout = continueModeTimeout;
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
        let alert = this.alertCtrl.create({
          title: 'Enter quantity value',
          // message: 'Inse',
          enableBackdropDismiss: false,
          inputs: [{ name: 'quantity', type: this.quantityType || 'number', placeholder: 'Eg. 5' }],
          buttons: [{
            text: 'Ok',
            handler: data => {
              if (data.quantity) { // && isNumber(data.quantity)
                scan.quantity = data.quantity;
              }
              this.nextScan(scan)
            }
          }, {
            role: 'cancel', text: 'Cancel',
            handler: () => {
              this.observer.complete();
            }
          }]
        })
        this.isQuantityDialogOpen = true;
        alert.onDidDismiss(() => {
          this.isQuantityDialogOpen = false;
        })
        alert.present();
      } else {
        this.nextScan(scan)
      }
    }, (err) => {
      console.log('@plugin err: ', err)
      this.observer.error(err)
    });
  }

  // this function can be shorter, but this way is more readable
  private nextScan(scan) {
    this.observer.next(scan);

    if (this.quantyEnabled) { // if the quantity is enabled
      // do the following for both ios and android:
      if (this.continuousMode) {
        this.showAddMoreDialog();
      } else {
        this.observer.complete();
      }
    } else {
      if (this.platform.is('android')) {
        if (this.continuousMode && this.continueModeTimeout) {
          this.showAddMoreDialog();
        } else if (!this.continuousMode) {
          this.observer.complete();
        }
      } else {
        if (this.continuousMode) {
          this.showAddMoreDialog();
        } else {
          this.observer.complete();
        }
      }
    }
  }

  showAddMoreDialog() {
    let interval = null;

    let alert = this.alertCtrl.create({
      title: 'Continue scanning?',
      message: 'Do you want to add another item to this scan session?',
      buttons: [{
        text: 'Stop', role: 'cancel',
        handler: () => {
          if (interval) clearInterval(interval);
          this.observer.complete();
        }
      }, {
        text: 'Continue', handler: () => {
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
