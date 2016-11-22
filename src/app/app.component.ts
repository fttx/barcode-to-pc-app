import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { StatusBar, Splashscreen, GoogleAnalytics } from 'ionic-native';

import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { WelcomePage } from '../pages/welcome/welcome';
import { Settings } from '../providers/settings';


@Component({
  template: `<ion-nav [root]="rootPage"></ion-nav>`,
})
export class MyApp {
  public rootPage;

  constructor(
    platform: Platform,
    private settings: Settings,
  ) {
    Promise.all([
      this.settings.getNoRunnings().then(
        value => {
          if (!value) {
            this.rootPage = WelcomePage;
          } else {
            this.rootPage = ScanSessionsPage;
          }
          let runnings = value || 0;
          this.settings.setNoRunnings(++runnings);
        }
      ),

      platform.ready().then(() => {
        // Okay, so the platform is ready and our plugins are available.
        // Here you can do any higher level native things you might need.
        StatusBar.overlaysWebView(true);
        StatusBar.backgroundColorByHexString('#B71C1C');

        GoogleAnalytics.startTrackerWithId('UA-87867313-1');
        // GoogleAnalytics.enableUncaughtExceptionReporting(true)
        //   .then((_success) => { 
        //     console.log("ERROR success:", _success)
        //   })
        //   .catch((_error) => {
        //     console.log("ERROR Google Analytics:", _error)
        //   })

      })
    ]).then(
      () => {
        Splashscreen.hide();
      })
  }
}
