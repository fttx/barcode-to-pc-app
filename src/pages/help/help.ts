import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { Config } from '../../providers/config';
import { BtpaInAppBrowser } from '../../providers/btpa-in-app-browser/btpa-in-app-browser';

/**
 * Generated class for the HelpPage page.
 *
 * See http://ionicframework.com/docs/components/#navigation for more info
 * on Ionic pages and navigation.
 */

@Component({
  selector: 'page-help',
  templateUrl: 'help.html',
})
export class HelpPage {


  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private iab: BtpaInAppBrowser,
  ) {
  }

  ionViewDidLoad() {
  }

  onFaqClick() {
    this.iab.create(Config.URL_FAQ, '_system');
  }

  onContactSupportClick() {
    this.iab.create('mailto:' + Config.EMAIL_SUPPORT, '_system');
  }

  getSupportEmail() {
    return Config.EMAIL_SUPPORT;
  }

}
