import { Component } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { NavController, NavParams } from 'ionic-angular';
import { Config } from '../../providers/config';

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
    private iab: InAppBrowser,
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
