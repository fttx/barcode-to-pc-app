import { AppVersion } from '@ionic-native/app-version';
import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { GoogleAnalyticsService } from '../../providers/google-analytics'

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {

  public websiteUrl = Config.WEBSITE_URL;
  public websiteName = Config.WEBSITE_NAME;
  public requiredServerVersion = Config.REQUIRED_SERVER_VERSION;
  public version = "";


  constructor(
    private googleAnalytics: GoogleAnalyticsService,
    private appVersion: AppVersion,
  ) { }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("AboutPage");
    this.appVersion.getVersionNumber().then(version => this.version = version);
  }

 

}
