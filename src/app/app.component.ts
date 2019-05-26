import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, NavController, ModalController, AlertController, Events } from 'ionic-angular';
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
import { MarkdownService } from 'ngx-markdown';
import { gt, SemVer } from 'semver';
import { ScanSessionsStorage } from '../providers/scan-sessions-storage';
import { ScanSessionModel } from '../models/scan-session.model';

@Component({
  templateUrl: 'app.html',
})
export class MyApp {
  @ViewChild('mainMenu') nav: NavController

  public rootPage;

  constructor(
    public platform: Platform,
    public splashScreen: SplashScreen,
    public statusBar: StatusBar,
    public appVersion: AppVersion,
    private alertCtrl: AlertController,
    private settings: Settings,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
    private ga: GoogleAnalytics,
    private http: Http,
    private utils: Utils,
    private markdownService: MarkdownService,
    private scanSessionsStorage: ScanSessionsStorage,
    public events: Events,
  ) {
    platform.ready().then(() => {

      this.ga.startTrackerWithId(Config.GOOGLE_ANALYTICS_ID).then(() => {
        this.ga.setAllowIDFACollection(true);

        if (Config.DEBUG) {
          this.ga.debugMode();
        }
      })

      Promise.all([this.settings.getNoRunnings(), this.settings.getEverConnected(), this.settings.getAlwaysSkipWelcomePage(), this.upgrade()]).then((results: any[]) => {
        let runnings = results[0];
        let everConnected = results[1];
        let alwaysSkipWelcomePage = results[2];
        // results[3] => upgrade
        
        if ((!runnings || !everConnected) && !alwaysSkipWelcomePage) {
          this.rootPage = WelcomePage;
        } else {
          this.rootPage = ScanSessionsPage;
        }

        let newRunnings = runnings || 0;
        this.settings.setNoRunnings(newRunnings + 1);

        splashScreen.hide();
        if (platform.is('ios')) {
          statusBar.overlaysWebView(true);
        }
      });
    });

    this.events.subscribe('setPage', (page, isRoot = false) => {
      this.setPage(page, isRoot);
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

  upgrade() {
    return new Promise((resolve, reject) => {
      Promise.all([this.settings.getLastVersion(), this.appVersion.getVersionNumber(), this.settings.getBarcodeFormats()]).then(async (results: any[]) => {
        let lastVersion = new SemVer(results[0]);
        let currentVersion = new SemVer(results[1]);
        let savedBarcodeFormats = results[2];

        // Given a version number MAJOR.MINOR.PATCH, increment the:
        // MAJOR version when you make incompatible API changes,
        // MINOR version when you add functionality in a backwards-compatible manner, and
        // PATCH version when you make backwards-compatible bug fixes.
        // see: https://semver.org/
        console.log('gt(currentVersion, lastVersion)= ', gt(currentVersion, lastVersion), currentVersion, lastVersion)
        if (gt(currentVersion, lastVersion) && lastVersion.compare('0.0.0') != 0) { // update detected (the second proposition is to exclude the first start)
          await this.settings.setBarcodeFormats(this.utils.updateBarcodeFormats(savedBarcodeFormats));

          // Changelog alert
          let httpRes = await this.http.get(Config.URL_GITHUB_CHANGELOG).toPromise();
          let changelog = '<div style="font-size: .1em">' + this.markdownService.compile(httpRes.text()) + '</div>';
          this.alertCtrl.create({
            title: 'The app has been updated',
            message: changelog,
            buttons: ['Ok'],
            cssClass: 'changelog'
          }).present();

          // Upgrade output profiles
          if (currentVersion.compare('3.1.0') == 0 || (currentVersion.compare('3.1.1') == 0 && lastVersion.compare('3.1.0') != 0)) {
            let scanSessions = await this.scanSessionsStorage.getScanSessions();
            console.log('updating... old = ', scanSessions)
            for (let scanSession of scanSessions) {
              for (let scan of scanSession.scannings) {
                scan.outputBlocks = [];

                scan.outputBlocks.push({
                  editable: false,
                  name: 'BARCODE',
                  value: scan.text,
                  type: 'barcode'
                });

                if (scan.quantity) {
                  scan.outputBlocks.push({
                    editable: false,
                    name: 'QUANTITY',
                    value: scan.quantity,
                    type: 'variable'
                  });
                }

                scan.outputBlocks.push({
                  editable: false,
                  name: 'ENTER',
                  value: 'enter',
                  type: 'key'
                });
              }
            }
            console.log('updating... new = ', scanSessions)
            await this.scanSessionsStorage.setScanSessions(scanSessions);
          }
        }
        await this.settings.setLastVersion(currentVersion.version);
        resolve(); // always resolve at the end (note the awaits!)
      })
    })
  }
}
