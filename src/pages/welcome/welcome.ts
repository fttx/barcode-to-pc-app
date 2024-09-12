import { Component, NgZone, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScanResult } from '@fttx/barcode-scanner';
import { TranslateService } from '@ngx-translate/core';
import { NavController, Slides, ViewController } from 'ionic-angular';
import { Observable, Subscription } from 'rxjs';
import { Config } from '../../providers/config';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { Utils } from '../../providers/utils';
import { ScanSessionsPage } from '../scan-sessions/scan-sessions';
import { ServerModel } from './../../models/server.model';
import { debounce } from 'helpful-decorators';
import { BTPAlert, BtpAlertController } from '../../providers/btp-alert-controller/btp-alert-controller';
import { BtpaInAppBrowser } from '../../providers/btpa-in-app-browser/btpa-in-app-browser';
import { IntelProvider } from '../../providers/intel/intel';
declare var window: any;

/*
  Generated class for the Welcome page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-welcome',
  templateUrl: 'welcome.html'
})
export class WelcomePage {
  @ViewChild('slider') slider: Slides;
  public connecting = true;
  public connected = false;

  private troubleshootingDialogTimeout = null;
  public currentAttemptingServer: ServerModel;
  private onConnectSubscription: Subscription;

  constructor(
    private alertCtrl: BtpAlertController,
    public navCtrl: NavController,
    private serverProvider: ServerProvider,
    public viewCtrl: ViewController,
    private settings: Settings,
    private ngZone: NgZone,
    private barcodeScanner: BarcodeScanner,
    private utils: Utils,
    private iab: BtpaInAppBrowser,
    private translateService: TranslateService,
    private intel: IntelProvider
  ) {

  }

  ionViewDidEnter() {
    window.cordova.plugins.firebase.analytics.setCurrentScreen("WelcomePage");
    this.onConnectSubscription = this.serverProvider.onConnect().subscribe((server) => {
      this.settings.setDefaultServer(server);
      this.slider.slideTo(this.slider.length() - 1);
      this.ngZone.run(() => {
        this.connecting = false;
      });
      this.connected = true;
      this.serverProvider.stopWatchForServers();
    });
  }

  ionViewDidLeave() {
    this.serverProvider.stopWatchForServers();
    this.onConnectSubscription.unsubscribe();
    clearTimeout(this.troubleshootingDialogTimeout);
  }

  async onSkipClicked() {
    window.cordova.plugins.firebase.analytics.logEvent('welcome_skip', {});

    let alert = this.alertCtrl.create({
      title: await this.utils.text('Skip Connection'),
      message: await this.utils.text('To send barcodes to your computer the connection is necessary. If you want to this later, skip it for now.'),
      inputs: [
        {
          type: 'checkbox',
          label: await this.utils.text('dontShowAnymoreDialogLabel'),
          value: 'alwaysSkipWelcomePage',
          checked: false
        }
      ],
      buttons: [
        {
          text: await this.utils.text('dontShowAnymoreSkipButton'),
          handler: data => {
            if (data == 'alwaysSkipWelcomePage') {
              this.settings.setAlwaysSkipWelcomePage(true);
            }
            this.navCtrl.setRoot(ScanSessionsPage);
          },
        },
        {
          text: await this.utils.text('Cancel'),
          role: 'cancel',
        },
      ]
    });
    alert.present();
  }

  onNextClicked() {
    if (this.slider.isEnd()) {
      return this.navCtrl.setRoot(ScanSessionsPage);
    }
    this.slider.slideNext();
  }

  onScanQRCodeClicked() {
    this.barcodeScanner.scan({
      "showFlipCameraButton": true, // iOS and Android
      formats: "QR_CODE"
    }).subscribe((scan: BarcodeScanResult) => {
      if (scan && scan.text) {
        let servers = ServerModel.serversFromJSON(scan.text);
        servers.forEach(server => {
          this.attempConnection(server);
        })
      }
    }, err => { });
  }

  onSlideChanged() {
    const activeIndex = this.slider.getActiveIndex();
    if (activeIndex == 2) {
      this.triggerAutoConnectAttempt();
    }

    if (activeIndex == 3) {
      this.scheduleShowTroubleshootingDialog();
      if (!this.settings.getSkipWiFiCheck()) this.utils.askWiFiEnableIfDisabled();
    }

    if (this.slider.isEnd()) {
      this.slider.slideTo(this.slider.length() - 1);
    }
  }

  getWebSiteName() {
    return Config.WEBSITE_NAME;
  }

  @debounce(2000)
  attempConnection(server: ServerModel, skipQueue = false) {
    if (this.connecting) {
      this.slider.slideTo(this.slider.length() - 1);
      this.currentAttemptingServer = server;
      this.serverProvider.connect(server, skipQueue)
      this.scheduleShowTroubleshootingDialog();
    }
  }

  scheduleShowTroubleshootingDialog() {
    console.log('[welcome] scheduleShowTroubleshootingDialog()')
    if (this.troubleshootingDialogTimeout) clearTimeout(this.troubleshootingDialogTimeout);

    this.troubleshootingDialogTimeout = setTimeout(async () => {
      if (this.connecting) {
        let alert = this.alertCtrl.create({
          title: await this.utils.text('connectionTakingTooLongDialogTitle'),
          message: await this.utils.text('connectionTakingTooLongDialogMessage'),
          buttons: [
            {
              text: await this.utils.text('connectionTakingTooLongTryAgainButton'),
              handler: () => {
                // This code is duplicated in ionViewDidEnter
                this.serverProvider.watchForServers().subscribe(data => {
                  if (data.action == 'added' || data.action == 'resolved') {
                    this.attempConnection(data.server)
                  }
                });
              }
            },
            {
              text: await this.utils.text('connectionTakingTooLongViewInstructionsButton'),
              role: 'cancel',
              handler: () => {
                this.iab.create(Config.URL_INSTRUCTIONS, '_system');
              }
            },
            {
              text: await this.utils.text('connectionTakingTooLongCancelButton'),
              role: 'cancel',
              handler: () => { }
            },
          ]
        });
        alert.present();
      }
    }, 1000 * 25) // 25 secs
  }

  private autoConnectionAttempted = false;
  triggerAutoConnectAttempt() {
    if (this.autoConnectionAttempted) return;
    console.log('[welcome] triggerAutoConnectAttempt()')
    this.autoConnectionAttempted = true;
    window.installReferrer.getReferrer((data: any) => {
      // Attempt to connect using referrer parameter from PlayStore
      // Example url generated by the QR Code:
      //  https://app.barcodetopc.com/?h=REFFERERR&a=192.168.0.9-192.168.0.21
      // Which redirects to:
      //  https://play.google.com/store/apps/details?id=com.barcodetopc&referrer=utm_source%3Dbarcode-to-pc-server%26utm_medium%3Dqr-code-pairing%26a%3D192.168.0.9-192.168.0.21%26h%3DREFFERERR
      if (data && data.a) {
        let addresses = data.a.split('-');
        let hostName = data.h || '';
        Observable.from(addresses)
          .zip(Observable.timer(0, 2000), x => x)
          .subscribe((address: string) => {
            this.attempConnection(ServerModel.AddressToServer(address, hostName), true);
          });
      }
    }, (error) => {
      // console.log('[installReferrer] error');
    });

    // this code is kind of duplicated for the "Try again" button
    this.serverProvider.watchForServers().delay(500).subscribe(data => { // delay to prevent this.slide null when the server gets published too fast
      if (data.action == 'added' || data.action == 'resolved') {
        this.attempConnection(data.server)
      }
    });
  }

  sendLinkToEmailClick() {
    window.cordova.plugins.firebase.analytics.logEvent('email_incentive_send_download_show', {});
    this.showEmailIncentiveAlert();
  }

  private inputEmailAlert: BTPAlert = null;
  private invalidEmailAlert: BTPAlert = null;
  private async showEmailIncentiveAlert() {
    if (this.inputEmailAlert) this.inputEmailAlert.dismiss();
    if (this.invalidEmailAlert) this.invalidEmailAlert.dismiss();
    this.inputEmailAlert = this.alertCtrl.create({
      cssClass: 'btp-get-more-scans-alert',
      inputs: [
        { name: 'email', type: 'email', placeholder: this.translateService.instant('Business Email'), value: localStorage.getItem('email') || '' },
      ],
      title: this.translateService.instant('Server Download Link'),
      buttons: [{
        text: this.translateService.instant('Get Link'), handler: (data) => {
          localStorage.setItem('email', data.email);
          const isValidEmail = data.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
          if (!isValidEmail) {
            this.invalidEmailAlert = this.alertCtrl.create({
              title: this.translateService.instant('Invalid Email'),
              message: this.translateService.instant('Please enter a valid email address'),
              buttons: [{ text: this.translateService.instant('Try again'), handler: () => { this.showEmailIncentiveAlert(); } }],
            });
            this.invalidEmailAlert.present();
            return false;
          }
          this.intel.incentiveEmailDownload(data.email);
          this.alertCtrl.create({
            title: this.translateService.instant('Done'),
            message: this.translateService.instant('Check your email inbox and spam folder'),
            buttons: [{
              text: this.translateService.instant('Close'), handler: () => {
                window.cordova.plugins.firebase.analytics.logEvent('email_incentive_send_download_success', {});
                this.slider.slideNext();
              }
            }],
          }).present();
        },
      }, { text: this.translateService.instant('Cancel'), role: 'text-cancel', handler: () => { }, },
      ]
    });
    await this.inputEmailAlert.present();
    // find the dom .alert-button-group and create a p element with html inside and add it before the alert-button-group
    const buttonGroup = document.querySelector('.alert-button-group');
    const p = document.createElement('p');
    p.innerHTML = `<small style="text-align: left; display: block; margin: 0 2px;">
    <input type="checkbox" checked style="width: auto; vertical-align: middle;" onclick="this.checked = true;">
    We may use and disclose your email address with our advertising partners to personalize content and deliver targeted advertisements, in accordance with our <a href="${Config.URL_PRIVACY_POLICY}">Privacy Policy</a>. You may opt-out at any time by clicking Unsubscribe.</small>`;
    // color: grey;
    // margin: 0px 23px 0 23px !important;
    p.style.color = 'grey';
    p.style.margin = '0px 24px 0 24px';
    buttonGroup.parentNode.insertBefore(p, buttonGroup);
  }

  showCancelText() {
    const index = this.slider.getActiveIndex();
    switch (index) {
      case 0:
        return null;
      case 1:
        return this.translateService.instant('Skip');
      case 2:
        return this.translateService.instant('Skip');
      default:
        return null;
    }
  }

  getShowScan() {
    const index = this.slider.getActiveIndex();
    switch (index) {
      case 2:
        return true;
      default:
        return false;
    }
  }

  getNextHidden() {
    const index = this.slider.getActiveIndex();

    switch (index) {
      case 0:
        return false;
      case 1:
        return false;
      case 2:
        return true;
      case 3: {
        return true
      }
      default:
        return true;
    }
  }

  showPager() {
    const index = this.slider.getActiveIndex();
    return index >= 1;
  }

  getNextButtonText() {
    const index = this.slider.getActiveIndex();
    if (index == 0) {
      return this.translateService.instant('Get Started');
    } else if (index == 3) {
      if (this.connected) {
        return this.translateService.instant('startScanningButton')
      } else {
        return this.translateService.instant('connectingButton')
      }
    }
    return this.translateService.instant('nextButton');
  }

  getStartScanningButtonHidden() {
    const index = this.slider.getActiveIndex();
    return index != 3;
  }

  getStartScanningButtonText() {
    return this.translateService.instant('startScanningButton')
  }

}
