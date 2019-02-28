import { Component } from '@angular/core';
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
  public faqUrl = Config.URL_FAQ;


  constructor(public navCtrl: NavController, public navParams: NavParams) {
  }

  ionViewDidLoad() {
  }

  contactSupportClick() {
    window.open('mailto:' + Config.EMAIL_SUPPORT, '_system');
  }

  getSupportEmail() {
    return Config.EMAIL_SUPPORT;
  }

}
