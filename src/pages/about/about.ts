import { Component } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Config } from '../../providers/config';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {
  public websiteName = Config.WEBSITE_NAME;
  public version = "";

  constructor(
    private firebaseAnalytics: FirebaseAnalytics,
    private appVersion: AppVersion,
    private iab: InAppBrowser,
  ) { }

  ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen("AboutPage");
  }

  ionViewWillEnter() {
    this.appVersion.getVersionNumber().then(version => this.version = version);
  }

  onWebSiteClick() {
    this.iab.create(Config.URL_WEBSITE, '_system');
  }

  onContactSupportClick() {
    this.iab.create('mailto:' + Config.EMAIL_SUPPORT, '_system');
  }

  getSupportEmail() {
    return Config.EMAIL_SUPPORT;
  }
}
