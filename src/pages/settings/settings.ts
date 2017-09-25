import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavController, ViewController, ToastController } from 'ionic-angular';
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
  public seconds = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
  public availableSeconds = Array.from(Array(30).keys());
  public scanMode = '';
  private changesSaved = false;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
    private toastCtrl: ToastController,
    private serverProvider: ServerProvider,
  ) {
  }

  ionViewDidLoad() {
    this.settings.getContinueModeTimeout().then(seconds => {
      if (seconds) {
        this.seconds = seconds;
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
    this.settings.setContinueModeTimeout(this.seconds);
    this.settings.setDefaultMode(this.scanMode);
    this.settings.setDeviceName(this.deviceName);

    this.serverProvider.send(new requestModelHelo().fromObject({ deviceName: this.deviceName }));

    let toast = this.toastCtrl.create({
      message: 'Settings saved',
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
