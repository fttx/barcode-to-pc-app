import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, NavController, ModalController, AlertController } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';

import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { WelcomePage } from '../pages/welcome/welcome';
import { SelectServerPage } from './../pages/select-server/select-server';
import { AboutPage } from '../pages/about/about';
import { Settings } from '../providers/settings';
import { SettingsPage } from '../pages/settings/settings';
import { StatusBar } from '@ionic-native/status-bar';
import { HelpPage } from '../pages/help/help';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { Config } from '../providers/config';
import { AppVersion } from '@ionic-native/app-version';
import { Http } from '@angular/http';
import { Utils } from '../providers/utils';
import { ArchivedPage } from '../pages/archived/archived';

@Component({
  templateUrl: 'app.html',
})
export class MyApp {
  @ViewChild('mainMenu') nav: NavController

  public rootPage;

  constructor(
    platform: Platform,
    splashScreen: SplashScreen,
    statusBar: StatusBar,
    appVersion: AppVersion,
    private alertCtrl: AlertController,
    private settings: Settings,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
    private ga: GoogleAnalytics,
    private http: Http,
    private utils: Utils
  ) {
    platform.ready().then(() => {

      this.ga.startTrackerWithId(Config.GOOGLE_ANALYTICS_ID).then(() => {
        this.ga.setAllowIDFACollection(true);

        if (Config.GOOGLE_ANALYTICS_DEBUG) {
          this.ga.debugMode();
        }
      })

      Promise.all([this.settings.getNoRunnings(), this.settings.getEverConnected(), this.settings.getAlwaysSkipWelcomePage(), this.settings.getLastVersion(), appVersion.getVersionNumber(), this.settings.getBarcodeFormats()]).then((results: any[]) => {
        let runnings = results[0];
        let everConnected = results[1];
        let alwaysSkipWelcomePage = results[2];
        let lastVersion = results[3];
        let currentVersion = results[4];
        let savedBarcodeFormats = results[5];

        if ((!runnings || !everConnected) && !alwaysSkipWelcomePage) {
          this.rootPage = WelcomePage;
        } else {
          this.rootPage = ScanSessionsPage;
        }

        let newRunnings = runnings || 0;
        this.settings.setNoRunnings(++newRunnings);

        if (lastVersion != currentVersion && newRunnings > 1) {
          this.settings.setBarcodeFormats(this.utils.updateBarcodeFormats(savedBarcodeFormats));

          this.http.get(Config.GITHUB_LATEST_RELEASE_URL).subscribe(res => {
            let changelog = '';

            let releases = [];
            releases = res.json();

            releases.forEach(release => {
              if (!release['prerelease'] && release['body'].length > 1) {
                changelog += '<h1>' + release['name'] + '</h1><ul>' + release['body'].replace(/\n\r/g, '<br>').replace(/\n/g, '<br>').replace(/\-/g, '<li>') + '</ul><br>';
              }
            });

            this.alertCtrl.create({
              title: 'The app has been updated',
              message: changelog,
              buttons: ['Ok']
            }).present();
          });
          this.settings.setLastVersion(currentVersion);
        }

        splashScreen.hide();
        if (platform.is('ios')) {
          statusBar.overlaysWebView(true);
        }
      });
    });
  }

  scanSessions() {
    this.setPage(ScanSessionsPage, true);
  }

  selectServer() {
    this.setPage(SelectServerPage);
  }

  archived() {
    this.setPage(ArchivedPage, true);
  }

  settingsPage() {
    this.menuCtrl.close();
    this.modalCtrl.create(SettingsPage).present();
  }

  about() {
    this.setPage(AboutPage);
  }

  help() {
    this.setPage(HelpPage);
  }

  setPage(page, isRoot = false) {
    if (this.nav.getActive().component != page) {
      this.menuCtrl.close();
      if (isRoot) {
        this.nav.setRoot(page);
      } else {
        this.nav.push(page);
      }
    } else {
      this.menuCtrl.close();
    }
  }
}
