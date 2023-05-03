import { Component, ViewChild } from '@angular/core';
import { Http } from '@angular/http';
import { AppVersion } from '@ionic-native/app-version';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { Insomnia } from '@ionic-native/insomnia';
import { NativeAudio } from '@ionic-native/native-audio';
import { StatusBar } from '@ionic-native/status-bar';
import { AlertController, Events, MenuController, ModalController, NavController, Platform } from 'ionic-angular';
import { MarkdownService } from 'ngx-markdown';
import { gt, SemVer } from 'semver';
import { ScanModel } from '../models/scan.model';
import { AboutPage } from '../pages/about/about';
import { ArchivedPage } from '../pages/archived/archived';
import { HelpPage } from '../pages/help/help';
import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { SettingsPage } from '../pages/settings/settings';
import { WelcomePage } from '../pages/welcome/welcome';
import { Config } from '../providers/config';
import { EventsReporterProvider } from '../providers/events-reporter/events-reporter';
import { ScanSessionsStorage } from '../providers/scan-sessions-storage';
import { Settings } from '../providers/settings';
import { Utils } from '../providers/utils';
import { SelectServerPage } from './../pages/select-server/select-server';
import { TranslateService } from '@ngx-translate/core';

@Component({
  templateUrl: 'app.html',
})
export class MyApp {
  @ViewChild('mainMenu') nav: NavController

  public rootPage;
  public static SERVER_PROGRAM_NAME: string;

  constructor(
    public platform: Platform,
    public statusBar: StatusBar,
    public appVersion: AppVersion,
    private alertCtrl: AlertController,
    private settings: Settings,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
    private firebaseAnalytics: FirebaseAnalytics,
    private http: Http,
    private utils: Utils,
    private markdownService: MarkdownService,
    private scanSessionsStorage: ScanSessionsStorage,
    public events: Events,
    private insomnia: Insomnia,
    public nativeAudio: NativeAudio,
    private eventsReporterProvider: EventsReporterProvider,
    private translate: TranslateService,
  ) {
    platform.ready().then(async () => {

      this.firebaseAnalytics.setEnabled(!Config.DEBUG);

      this.translate.use('en');
      this.translate.onLangChange.subscribe(event => {
        if (event.lang === 'ar') {
          document.documentElement.setAttribute('dir', 'rtl');
        } else {
          document.documentElement.setAttribute('dir', 'ltr');
        }
      });
      this.translate.addLangs(['es', 'pt', 'ar']);
      const lang = this.translate.getBrowserLang();
      if (lang !== undefined && this.translate.getLangs().indexOf(lang) != -1) {
        this.translate.use(lang);
      }
      MyApp.SERVER_PROGRAM_NAME = await this.utils.text('barcodeToPcServer');

      this.nativeAudio.preloadSimple('beep_high', 'assets/audio/beep_high.ogg');
      this.nativeAudio.preloadSimple('beep_low', 'assets/audio/beep_low.ogg');
      this.nativeAudio.preloadSimple('beep_two_tone', 'assets/audio/beep_two_tone.ogg');
      this.nativeAudio.preloadSimple('beep_double', 'assets/audio/beep_double.ogg');
      this.nativeAudio.preloadSimple('beep', 'assets/audio/beep.ogg');

      Promise.all([this.settings.getNoRunnings(), this.settings.getEverConnected(), this.settings.getAlwaysSkipWelcomePage(), this.upgrade(), this.settings.getKeepDisplayOn()]).then((results: any[]) => {
        let runnings = results[0];
        let everConnected = results[1];
        let alwaysSkipWelcomePage = results[2];
        // results[3] => upgrade
        let keepDisplayOn = results[4];

        if ((!runnings || !everConnected) && !alwaysSkipWelcomePage) {
          this.rootPage = WelcomePage;
        } else {
          this.rootPage = ScanSessionsPage;
        }

        let newRunnings = runnings || 0;
        this.settings.setNoRunnings(newRunnings + 1);

        if (keepDisplayOn) {
          this.insomnia.keepAwake();
        }

        if (platform.is('ios')) {
          statusBar.overlaysWebView(true);
        }

        this.eventsReporterProvider.init();
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
    return new Promise<void>((resolve, reject) => {
      Promise.all([this.settings.getLastVersion(), this.appVersion.getVersionNumber(), this.settings.getBarcodeFormats()]).then(async (results: any[]) => {
        let lastVersion = new SemVer(results[0]);
        let currentVersion = new SemVer(results[1]);
        let savedBarcodeFormats = results[2];

        // Given a version number MAJOR.MINOR.PATCH, increment the:
        // MAJOR version when you make incompatible API changes,
        // MINOR version when you add functionality in a backwards-compatible manner, and
        // PATCH version when you make backwards-compatible bug fixes.
        // see: https://semver.org/
        // console.log('gt(currentVersion, lastVersion)= ', gt(currentVersion, lastVersion), currentVersion, lastVersion)
        if (gt(currentVersion, lastVersion) && lastVersion.compare('0.0.0') != 0) { // update detected (the second proposition is to exclude the first start)
          await this.settings.setBarcodeFormats(this.utils.updateBarcodeFormats(savedBarcodeFormats));

          // Changelog alert
          let httpRes = await this.http.get(Config.URL_GITHUB_CHANGELOG).toPromise();
          let changelog = 'Please make you sure to update also the server on your computer.<div style="font-size: .1em">' + this.markdownService.compile(httpRes.text()) + '</div>';
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
                  name: 'BARCODE',
                  value: scan.text,
                  type: 'barcode'
                });

                if (scan.quantity) {
                  scan.outputBlocks.push({
                    name: 'NUMBER',
                    value: scan.quantity,
                    type: 'variable'
                  });
                }

                scan.outputBlocks.push({
                  name: 'ENTER',
                  value: 'enter',
                  type: 'key'
                });
              }
            }
            console.log('updating... new = ', scanSessions)
            await this.scanSessionsStorage.setScanSessions(scanSessions);
          }
          // Upgrade output profiles end


          // Upgrade displayValue
          let displayValue = await this.settings.getUpgradedDisplayValue();
          if (
            // if it's upgrading from an older version, and the upgrade was never started (null)
            (lastVersion.compare('3.1.5') == -1 && displayValue == null)
            || // or
            // if the update has been started, but not completed (null)
            displayValue === false) {

            // mark the update as "started"
            await this.settings.setUpgradedDisplayValue(false);

            let alert = this.alertCtrl.create({
              title: 'Updating database',
              message: 'The app database is updating, <b>do not close</b> it.<br><br>It may take few minutes, please wait...',
              enableBackdropDismiss: false,
            });

            // upgrade db
            alert.present();
            let scanSessions = await this.scanSessionsStorage.getScanSessions();
            for (let scanSession of scanSessions) {
              for (let scan of scanSession.scannings) {
                scan.displayValue = ScanModel.ToString(scan);
              }
            }
            await this.scanSessionsStorage.setScanSessions(scanSessions);
            alert.dismiss();

            // mark the update as "finished" (true)
            await this.settings.setUpgradedDisplayValue(true);
          } // Upgrade displayName end

          if (currentVersion.compare('3.11.0') == 0) {
            await this.settings.setEnableVibrationFeedback(true);
          } // 3.11.0

          // Upgrade syncedWith (UUID)
          if (currentVersion.compare('3.15.0') == 0) {
            let alert = this.alertCtrl.create({
              title: 'Updating database',
              message: 'The app database is updating, <b>do not close</b> it.<br><br>It may take few minutes, please wait...',
              enableBackdropDismiss: false,
            });
            alert.present();
            let scanSessions = await this.scanSessionsStorage.getScanSessions();
            for (let scanSession of scanSessions) {
              scanSession.syncedWith = [];
            }
            await this.scanSessionsStorage.setScanSessions(scanSessions);
            alert.dismiss();
          } // Upgrade syncedWith (UUID) end

          // v4.0.0
          if (currentVersion.compare('4.0.0') >= 0) {
            const oldChoice: any = await this.settings.getDuplicateBarcodeChoice();
            if (oldChoice == 'accept') {
              this.settings.setDuplicateBarcodeChoice('always_accept');
            } else if (oldChoice == 'discard') {
              this.settings.setDuplicateBarcodeChoice('discard_scan_session');
            }
            await this.settings.upgradeV4SavedServers();
          }
        }
        await this.settings.setLastVersion(currentVersion.version);
        resolve(); // always resolve at the end (note the awaits!)
      })
    })
  }
}
