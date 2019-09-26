import { Component } from '@angular/core';
import { Device } from '@ionic-native/device';
import { NavController, ViewController } from 'ionic-angular';

import { barcodeFormatModel } from '../../models/barcode-format.model';
import { requestModelHelo } from '../../models/request.model';
import { ServerProvider } from '../../providers/server';
import { SelectScanningModePage } from '../scan-session/select-scanning-mode/select-scanning-mode';
import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { AppVersion } from '@ionic-native/app-version';
import { Insomnia } from '@ionic-native/insomnia';

/*
  Generated class for the Settings page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html'
})
export class SettingsPage {
  public deviceName: string;
  public scanSessionName: string;
  public continueModeTimeout = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
  public repeatInterval = Config.DEFAULT_REPEAT_INVERVAL;
  public availableContinueModeTimeouts = Array.from(Array(30).keys());
  public availableRepeatIntervals = [];
  public scanMode = '';
  public preferFrontCamera = false;
  public keepDisplayOn = false;
  private changesSaved = false;
  public quantityType: string = 'number';

  public barcodeFormats: barcodeFormatModel[] = barcodeFormatModel.supportedBarcodeFormats
  public enableLimitBarcodeFormats: boolean = false;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
    private serverProvider: ServerProvider,
    public appVersion: AppVersion,
    private device: Device,
    private insomnia: Insomnia,
  ) {
    for (let i = 0; i <= 15000; i += 250) {
      this.availableRepeatIntervals.push(i);
    }
  }

  ionViewDidLoad() {
    this.settings.getContinueModeTimeout().then(seconds => {
      if (seconds) {
        this.continueModeTimeout = seconds;
      }
    })

    this.settings.getDefaultMode().then(scanMode => {
      if (scanMode) {
        this.scanMode = scanMode;
      }
    })

    this.settings.getDeviceName().then(deviceName => {
      this.deviceName = deviceName;
    })

    this.settings.getScanSessionName().then(scanSessionName => {
      this.scanSessionName = scanSessionName;
    })

    this.settings.getRepeatInterval().then(repeatInterval => {
      if (repeatInterval != null) {
        this.repeatInterval = repeatInterval;
      }
    })

    this.settings.getBarcodeFormats().then(barcodeFormats => {
      this.barcodeFormats = barcodeFormats;
    })

    this.settings.getEnableLimitBarcodeFormats().then(enableLimitBarcodeFormats => {
      this.enableLimitBarcodeFormats = enableLimitBarcodeFormats;
    })

    this.settings.getPreferFrontCamera().then(preferFrontCamera => {
      this.preferFrontCamera = preferFrontCamera;
    });

    this.settings.getKeepDisplayOn().then(keepDisplayOn => {
      this.keepDisplayOn = keepDisplayOn;
    });

    this.settings.getQuantityType().then(quantityType => {
      if (quantityType) {
        this.quantityType = quantityType;
      }
    });
  }

  ionViewWillLeave() {
    if (!this.changesSaved) {
      this.saveChanges();
    }
  }

  dismiss() {
    this.changesSaved = true;
    this.saveChanges();
    this.viewCtrl.dismiss();
  }

  async saveChanges() {
    this.settings.setContinueModeTimeout(this.continueModeTimeout);
    this.settings.setRepeatInterval(this.repeatInterval);
    this.settings.setDefaultMode(this.scanMode);
    this.settings.setDeviceName(this.deviceName);
    this.settings.setScanSessionName(this.scanSessionName);
    this.settings.setPreferFrontCamera(this.preferFrontCamera);
    this.settings.setKeepDisplayOn(this.keepDisplayOn);
    this.settings.setBarcodeFormats(this.barcodeFormats);
    this.settings.setEnableLimitBarcodeFormats(this.enableLimitBarcodeFormats);
    this.settings.setQuantityType(this.quantityType);

    if (this.keepDisplayOn) {
      this.insomnia.keepAwake();
    } else {
      this.insomnia.allowSleepAgain()
    }

    this.serverProvider.send(new requestModelHelo().fromObject({
      version: await this.appVersion.getVersionNumber(),
      deviceName: this.deviceName,
      deviceId: this.device.uuid
    }));

    // let toast = this.toastCtrl.create({
    //   message: 'Settings saved',
    //   duration: 2000,
    //   position: 'bottom'
    // });
    // toast.present();
  }


  public getScanModeName = SelectScanningModePage.GetScanModeName;
  public getScanModeList = SelectScanningModePage.GetScanModeList;
}
