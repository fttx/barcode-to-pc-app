import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';
import { ServerProvider } from "../../providers/server";
import { requestModelHelo } from '../../models/request.model';
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
  public continueModeTimeout = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
  public repeatInterval = Config.DEFAULT_REPEAT_INVERVAL;
  public availableContinueModeTimeouts = Array.from(Array(30).keys());
  public availableRepeatIntervals = [];
  public scanMode = '';
  public preferFrontCamera = false;
  private changesSaved = false;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
    private serverProvider: ServerProvider,
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

    this.settings.getRepeatInterval().then(repeatInterval => {
      this.repeatInterval = repeatInterval;
    })

    this.settings.getPreferFrontCamera().then(preferFrontCamera => {
      this.preferFrontCamera = preferFrontCamera;
    })
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

  saveChanges() {
    this.settings.setContinueModeTimeout(this.continueModeTimeout);
    this.settings.setRepeatInterval(this.repeatInterval);
    this.settings.setDefaultMode(this.scanMode);
    this.settings.setDeviceName(this.deviceName);
    this.settings.setPreferFrontCamera(this.preferFrontCamera);

    this.serverProvider.send(new requestModelHelo().fromObject({ deviceName: this.deviceName }));

    // let toast = this.toastCtrl.create({
    //   message: 'Settings saved',
    //   duration: 2000,
    //   position: 'bottom'
    // });
    // toast.present();
  }
}
