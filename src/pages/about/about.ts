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


  constructor(
    private googleAnalytics: GoogleAnalyticsService,
  ) { }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("AboutPage");
  }

}
