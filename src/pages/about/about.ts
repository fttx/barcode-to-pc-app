import { Component } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Config } from '../../providers/config';
import { ZebraProvider } from '../../providers/zebra/zebra';
import { Events } from 'ionic-angular';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {
  public websiteName = Config.WEBSITE_NAME;
  public barcodebyteName = Config.BARCODEBYTE_NAME;
  public dataWedgeVersion = null;
  public version = "";

  constructor(
    private appVersion: AppVersion,
    private iab: InAppBrowser,
    private events: Events,
    private zebra: ZebraProvider,
  ) { }

  ionViewDidEnter() {
    window.cordova.plugins.firebase.analytics.setCurrentScreen("AboutPage");
  }

  ionViewWillEnter() {
    this.appVersion.getVersionNumber().then(version => this.version = version);
    this.zebra.init();
    this.events.subscribe('status:version', (version) => {
      this.dataWedgeVersion = version.DATAWEDGE;
    });
    this.zebra.requestVersion();
  }

  ionViewWillLeave() {
    this.zebra.close();
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

  onBarcodeByteClick() {
    this.iab.create(Config.URL_BARCODEBYTE, '_system');
  }

  onPrivacyPolicyClick() {
    this.iab.create(Config.URL_PRIVACY_POLICY, '_system');
  }
}
