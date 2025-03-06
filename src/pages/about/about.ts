import { Component } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { Config } from '../../providers/config';
import { ZebraProvider } from '../../providers/zebra/zebra';
import { Events } from 'ionic-angular';
import { LastToastProvider } from '../../providers/last-toast/last-toast';
import { BtpaInAppBrowser } from '../../providers/btpa-in-app-browser/btpa-in-app-browser';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {
  public websiteName = Config.WEBSITE_NAME;
  public companyWebsiteName = Config.COMPANY_WEBSITE_NAME;
  public dataWedgeVersion = null;
  public version = "";
  public debug = null;
  public zebraDebug = '';

  constructor(
    private appVersion: AppVersion,
    private iab: BtpaInAppBrowser,
    private events: Events,
    private zebra: ZebraProvider,
    private lastToast: LastToastProvider,
  ) { }

  ionViewDidEnter() {
    window.cordova.plugins.firebase.analytics.setCurrentScreen("AboutPage");
    this.loadDebug();
  }

  ionViewWillEnter() {
    this.appVersion.getVersionNumber().then(version => this.version = version);
    this.zebra.init();
    this.events.subscribe('status:version', (version) => {
      this.dataWedgeVersion = version.DATAWEDGE;
      this.zebraDebug = Object.keys(version).map(key => `${key}: ${version[key]}`).join('<br>');
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

  onCompanyWebsiteClick() {
    this.iab.create(Config.URL_COMPANY_WEBSITE, '_system');
  }

  onPrivacyPolicyClick() {
    this.iab.create(Config.URL_PRIVACY_POLICY, '_system');
  }

  private appVersionClickCount = 0;
  appVersionClick() {
    this.appVersionClickCount++;
    setTimeout(() => { this.appVersionClickCount = 0; }, 5000);
    if (this.appVersionClickCount >= 5) {
      this.lastToast.present("Debug enabled");
      localStorage.setItem("debug", "true");
      this.loadDebug();
    }
  }

  private loadDebug() {
    if (localStorage.getItem("debug") === "true") {
      this.debug = `
      <b>Google Analytics</b>:<br>
        ALLOW_AD_STORAGE: ${localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE')} <br>
        ALLOW_AD_USER_DATA: ${localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA')} <br>
        ALLOW_AD_PERSONALIZATION_SIGNALS: ${localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS')} <br>
        ALLOW_ANALYTICS_STORAGE: ${localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE')} <br>
      <br>
      <b>Zebra</b>:<br>
          ${this.zebraDebug} <br>
      <br>
`;
    }
  }
}
