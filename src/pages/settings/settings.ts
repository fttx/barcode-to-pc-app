import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavController, ViewController, ToastController } from 'ionic-angular';
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
  public seconds = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
  public scanMode = '';
  private changesSaved = false;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
    private toastCtrl: ToastController
  ) {
  }

  ionViewDidLoad() {
    this.settings.getContinueModeTimeout().then(seconds => {
      this.seconds = seconds;
    })

    this.settings.getDefaultMode().then(scanMode => {
      this.scanMode = scanMode;
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
    
    
    let toast = this.toastCtrl.create({
      message: 'Settings saved',
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }
}
