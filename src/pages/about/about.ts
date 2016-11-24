import { Component } from '@angular/core';
import { GoogleAnalyticsService } from '../../providers/google-analytics'

@Component({
  selector: 'page-about',
  templateUrl: 'about.html'
})
export class AboutPage {

  constructor(
    private googleAnalytics: GoogleAnalyticsService,
  ) {  }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("AboutPage");
  }

}
