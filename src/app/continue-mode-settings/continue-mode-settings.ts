import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';

/*
  Generated class for the EditScanSession page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-continue-mode-settings',
  templateUrl: 'continue-mode-settings.html'
})
export class ContinueModeSettingsPage {
  public enabled = true;
  public seconds = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
  ) {
  }

  ionViewDidLoad() {
    this.settings.getContinueModeTimeout().then(seconds => {
      this.seconds = seconds;
      this.enabled = seconds != -1;
    })
  }

  dismiss() {
    if (!this.enabled) {
      this.seconds = -1;
    }
    this.settings.setContinueModeTimeout(this.seconds);
    this.viewCtrl.dismiss();
  }

}
