import { Component, ViewChild } from '@angular/core';
import { Http } from '@angular/http';
import { AppVersion } from '@ionic-native/app-version';
import { Insomnia } from '@ionic-native/insomnia';
import { NativeAudio } from '@ionic-native/native-audio';
import { StatusBar } from '@ionic-native/status-bar';
import { Events, MenuController, ModalController, NavController, Platform } from 'ionic-angular';
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
import { BtpToastService } from '../components/btp-toast/btp-toast.service';
import { BtpAlertController } from '../providers/btp-alert-controller/btp-alert-controller';
import { requestModelEmailIncentiveCompleted } from '../models/request.model';
import { ServerProvider } from '../providers/server';
import { responseModel } from '../models/response.model';
import { BtpaInAppBrowser } from '../providers/btpa-in-app-browser/btpa-in-app-browser';
import { Device } from '@ionic-native/device';

@Component({
  templateUrl: 'app.html',
})
export class MyApp {
  @ViewChild('mainMenu') nav: NavController
  @ViewChild('btpToast') btpToast: any;

  public rootPage;
  public static SERVER_PROGRAM_NAME: string;

  constructor(
    public platform: Platform,
    public statusBar: StatusBar,
    public appVersion: AppVersion,
    private alertCtrl: BtpAlertController,
    private settings: Settings,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
    private http: Http,
    private utils: Utils,
    private markdownService: MarkdownService,
    private scanSessionsStorage: ScanSessionsStorage,
    public events: Events,
    private insomnia: Insomnia,
    public nativeAudio: NativeAudio,
    private eventsReporterProvider: EventsReporterProvider,
    private translate: TranslateService,
    private iab: BtpaInAppBrowser,
    private btpToastCtrl: BtpToastService,
    private device: Device,
  ) {
    platform.ready().then(async () => {

      // define dummy objects for plugins when running in browser
      if (!this.platform.is('cordova')) {
        if (!window.cordova) window.cordova = {};

        // cordova.getAppVersion
        window.cordova.getAppVersion = {
          getVersionNumber: () => { return new Promise((resolve, reject) => { resolve('0.0.0'); }) }
        }
        this.appVersion.getVersionNumber = window.cordova.getAppVersion.getVersionNumber;

        // installReferrer
        window.installReferrer = {
          getReferrer: (data) => { return data; }
        }
        window.installReferrer.getReferrer(null);
        window.cordova.plugins = {
          firebase: {
            analytics: {
              setEnabled: () => { },
              setAnalyticsConsent: () => { },
              setCurrentScreen: () => { },
              logEvent: () => { },
            }
          },
          idfa: {
            getInfo: () => { return new Promise((resolve, reject) => { resolve({ trackingLimited: false, idfa: '00000000-0000-0000-0000-000000000000' }); }) },
          },
        }

        window.device = {
          platform: 'browser',
          model: 'browser',
          uuid: 'browser',
          version: 'browser',
          manufacturer: 'browser',
          isVirtual: true,
          serial: 'browser'
        }

        window.plugins = {
          NativeAudio: {
            preloadComplex: (id, assetPath, volume, voices, delay, successCallback, errorCallback) => {
              console.log(`Dummy NativeAudio.preloadComplex called with id: ${id}, assetPath: ${assetPath}`);
              successCallback();
            },
            preloadSimple: (id, assetPath, successCallback, errorCallback) => {
              console.log(`Dummy NativeAudio.preloadSimple called with id: ${id}, assetPath: ${assetPath}`);
              successCallback();
            },
            play: (id) => {
              console.log(`Dummy NativeAudio.play called with id: ${id}`);
            },
            loop: (id) => {
              console.log(`Dummy NativeAudio.loop called with id: ${id}`);
            },
            stop: (id) => {
              console.log(`Dummy NativeAudio.stop called with id: ${id}`);
            },
            unload: (id) => {
              console.log(`Dummy NativeAudio.unload called with id: ${id}`);
            }
          },
          intentShim: {
            registerBroadcastReceiver: (filters, callback) => {
              console.log('Dummy registerBroadcastReceiver listening for:', filters);
              // console.log('Dummy registerBroadcastReceiver called for:', filters);
              // callback();
            }
          },
        }

        window['LaunchReview'] = {
          launch: (appId) => {
            console.log('Dummy LaunchReview.launch called with appId:', appId);
          },
          isRatingSupported: () => {
            console.log('Dummy LaunchReview.isRatingSupported called');
            return Promise.resolve(true);
          },
          rating: () => {
            console.log('Dummy LaunchReview.rating called');
            return Promise.resolve();
          }
        }
      }


      this.nav.viewWillEnter.subscribe((view) => { document.body.classList.add('btp-ionic-transitioning'); });
      this.nav.viewDidLeave.subscribe((view) => { document.body.classList.remove('btp-ionic-transitioning'); });

      window.cordova.plugins.firebase.analytics.setEnabled(!Config.DEBUG);

      this.translate.use('en');
      this.translate.onLangChange.subscribe(event => {
        if (event.lang === 'ar') {
          document.documentElement.setAttribute('dir', 'rtl');
        } else {
          document.documentElement.setAttribute('dir', 'ltr');
        }
      });
      this.translate.addLangs(['ar', 'de', 'es', 'it', 'pt', 'tr', 'tw', 'ru']);
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

      if (this.platform.is('ios')) {
        // Listen for when the keyboard will be shown
        window.addEventListener('keyboardWillShow', () => {
          const iosToolbar = document.querySelector('.ios-toolbar');
          if (!iosToolbar) return;
          iosToolbar.classList.add('keyboard-opened');
          iosToolbar.classList.remove('keyboard-hidden');
        });
        window.addEventListener('keyboardWillHide', () => {
          const iosToolbar = document.querySelector('.ios-toolbar');
          if (!iosToolbar) return;
          iosToolbar.classList.add('keyboard-hidden');
          iosToolbar.classList.remove('keyboard-open');
        });
      }

      Promise.all([this.settings.getNoRunnings(), this.settings.getEverConnected(), this.settings.getAlwaysSkipWelcomePage(), this.upgrade(), this.settings.getKeepDisplayOn(), this.settings.getHasAcceptedDisclosure()]).then(async (results: any[]) => {
        let runnings = results[0];
        let everConnected = results[1];
        let alwaysSkipWelcomePage = results[2];
        // results[3] => upgrade
        let keepDisplayOn = results[4];
        let hasAcceptedDisclosure = results[5];

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


        if (platform.is('ios')) {
          this.settings.setHasAcceptedDisclosure(true); // Enable GA4 consent -> Request optional IDFA -> (Save to avoid showing the dialog again)
          this.readAndSetGoogleAnalyticsConsent(true);
          this.showIOSIDFATrackingDialog();
        }

        if (platform.is('android')) {
          if (hasAcceptedDisclosure) {
            this.readAndSetGoogleAnalyticsConsent();
          } else {
            const hasAcceptedDisclosure = await this.showProminentDisclosureDialog(); // prominent disclosure -> inmobi consent -> enable GA4 consent -> (Show this until everything is accepted)
            this.settings.setHasAcceptedDisclosure(hasAcceptedDisclosure);
            this.showInMobiConsentScreen();
          }
        }
        this.eventsReporterProvider.init();
      });

      window.InitFormbricks();
      setTimeout(() => {
        window.InitFormbricks();
      }, 1000 * 60); // minute

      // Enterprise logic
      this.events.subscribe('scan:barcode', async (barcodeText) => {
        try {
          const data = JSON.parse(barcodeText);
          if (data.btp) {
            const response: any = (await this.http.post(Config.URL_LICENSE_SERVER_ENTERPRISE_CLAIM, {
              code: data.code,
              deviceId: this.device.uuid,
              deviceName: await this.settings.getDeviceName(),
            }).toPromise()).json();

            if (response.enterprise_data && response.enterprise_data.settings) {
              this.alertCtrl.create({
                title: 'Device linked ' + response.devices.length + '/' + response.devices_count_limit,
                message: "As part of the Enterprise Plan, you've successfully linked this device to your account.",
                enableBackdropDismiss: false,
                buttons: [
                  {
                    text: 'Ok',
                    handler: () => { }
                  }
                ]
              }).present();

              this.settings.applySettingsFromJson(response.enterprise_data.settings);
            }
          }
        } catch (e) { }
      });
    });

    this.events.subscribe('setPage', (page, isRoot = false) => {
      this.setPage(page, isRoot);
    });

    this.events.subscribe('incentive_email_alert_show', () => {
      this.nav.setRoot(ScanSessionsPage);
    });
  }

  ngAfterViewInit() {
    this.btpToastCtrl.setToastComponent(this.btpToast);
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
            buttons: [{ text: 'Ok' }],
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

          // If had 4.0.0+ installed
          if (lastVersion.compare('4.0.0') >= 0) {
            this.settings.setHasAcceptedDisclosure(true);
            this.readAndSetGoogleAnalyticsConsent(true);
          }
        }
        await this.settings.setLastVersion(currentVersion.version);
        resolve(); // always resolve at the end (note the awaits!)
      })
    })
  }

  showProminentDisclosureDialog() {
    return new Promise<boolean>((resolve, reject) => {
      this.alertCtrl.create({
        message: `
        <h1>Why do we require permissions?</h1>
        Barcode to PC collects images and location data to enable the real-time LAN synchronization with the selected Barcode to PC server.

        <div class="permission-header">
          <img src="assets/prominent-disclosure/image.png"> <h2>Images</h2>
        </div>
        Barcode to PC collects images to enable real-time synchronization of pictures associated to scanned barcodes, only when the app is in use.

        <div class="permission-header">
          <img src="assets/prominent-disclosure/location.png"> <h2>Location</h2>
        </div>
        Barcode to PC collects location data to enable real-time synchronization of barcodes metadata, even when the app is not in use.

        <br><br>

        Note that the app uses such permissions <u>only when you configure to do so</u> in your Output template settings.

        <br><br>

        Anonymized app usage statistics are shared with third parties to improve the app experience.
      `,
        cssClass: 'btp-prominet-disclosure',
        buttons: [
          {
            text: 'Learn more',
            handler: () => {
              this.iab.create(Config.URL_PRIVACY_POLICY, '_system');
              this.showProminentDisclosureDialog();
              resolve(false);
            },
            role: 'cancel',
          },
          {
            text: 'Agree',
            handler: () => {
              resolve(true);
            },
          }
        ],
        enableBackdropDismiss: false,
      }).present();
    });
  }


  showInMobiConsentScreen() {
    // Set an interval that checks every 100ms if the InMobi consent screen has been loaded and overrides the text of the .qc-cmp2-publisher-logo-container h2 element to "Cookie Policy"
    const overrideH2 = setInterval(() => {
      let targetSpan = document.querySelector("#qc-cmp2-ui span");
      if (targetSpan) {
        targetSpan.textContent = "Cookie Policy";
      }
    }, 100);
    setTimeout(() => { clearInterval(overrideH2); }, 5000);
    window.ShowInMobiConsentScreen();
    window.__tcfapi('addEventListener', 2, (tcData, success) => {
      // console.log('tcData', tcData); // tcData doesn't contain anything useful
      if ((tcData && tcData.gdprApplies == false) || this.platform.is('ios')) {
        this.readAndSetGoogleAnalyticsConsent(true);
      } else {
        this.readAndSetGoogleAnalyticsConsent();
      }
    });
  }

  async showIOSIDFATrackingDialog() {
    const idfaPlugin = window.cordova.plugins.idfa;
    let id = await idfaPlugin.getInfo()
      .then(info => {
        if (!info.trackingLimited) {
          return info.idfa || info.aaid;
        } else if (info.trackingPermission === idfaPlugin.TRACKING_PERMISSION_NOT_DETERMINED) {
          return idfaPlugin.requestPermission().then(result => {
            if (result === idfaPlugin.TRACKING_PERMISSION_AUTHORIZED) {
              return idfaPlugin.getInfo().then(info => {
                return info.idfa || info.aaid;
              });
            }
          });
        }
      })
      .then(idfaOrAaid => { if (idfaOrAaid) { console.log(idfaOrAaid); } });
  }

  readAndSetGoogleAnalyticsConsent(forceToTrue = false) {
    if (forceToTrue) {
      const gaFlags = {
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE: true,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA: true,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS: true,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE: true,
      }
      window.cordova.plugins.firebase.analytics.setAnalyticsConsent(gaFlags);
    } else {
      // We use this hack to intercept the consent data from the InMobi consent screen that is pushed to the datalayer (see index.html)
      const gaFlags = {
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE: localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_STORAGE') || false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA: localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_USER_DATA') || false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS: localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS') || false,
        GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE: localStorage.getItem('GOOGLE_ANALYTICS_DEFAULT_ALLOW_ANALYTICS_STORAGE') || false,
      }
      // Pass the consent flags to the Firebase Analytics native plugin
      window.cordova.plugins.firebase.analytics.setAnalyticsConsent(gaFlags);
    }
  }
}
