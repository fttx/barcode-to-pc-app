import { AppVersion } from '@ionic-native/app-version';
import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { GoogleAnalytics } from '@ionic-native/google-analytics';

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {

  public websiteUrl = Config.URL_WEBSITE;
  public websiteName = Config.WEBSITE_NAME;
  public requiredServerVersion = Config.REQUIRED_SERVER_VERSION;
  public version = "";


  constructor(
    private ga: GoogleAnalytics,
    private appVersion: AppVersion,
  ) { }

  ionViewDidEnter() {
    this.ga.trackView("AboutPage");
  }

  ionViewWillEnter() {
    this.appVersion.getVersionNumber().then(version => this.version = version);
  }



}
