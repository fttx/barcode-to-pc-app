import { Component, NgZone, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScanResult } from '@fttx/barcode-scanner';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { TranslateService } from '@ngx-translate/core';
import { AlertController, NavController, Slides, ViewController } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { Config } from '../../providers/config';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { Utils } from '../../providers/utils';
import { ScanSessionsPage } from '../scan-sessions/scan-sessions';
import { ServerModel } from './../../models/server.model';

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
  public showNext = true;
  public connecting = true;
  public connected = false;

  private troubleshootingDialogTimeout = null;
  public currentAttemptingServer: ServerModel;
  private onConnectSubscription: Subscription;

  constructor(
    private alertCtrl: AlertController,
    public navCtrl: NavController,
    private serverProvider: ServerProvider,
    public viewCtrl: ViewController,
    private settings: Settings,
    private ngZone: NgZone,
    private firebaseAnalytics: FirebaseAnalytics,
    private barcodeScanner: BarcodeScanner,
    private utils: Utils,
    private iab: InAppBrowser,
  ) { }

  ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen("WelcomePage");
    this.onConnectSubscription = this.serverProvider.onConnect().subscribe((server) => {
      this.settings.setDefaultServer(server);
      this.slider.slideTo(this.slider.length() - 1);
      this.ngZone.run(() => {
        this.connecting = false;
        this.showNext = false;
      });
      this.connected = true;
      this.serverProvider.stopWatchForServers();
    });

    // this code is kind of duplicated for the "Try again" button
    this.serverProvider.watchForServers().delay(500).subscribe(data => { // delay to prevent this.slide null when the server gets published too fast
      if (data.action == 'added' || data.action == 'resolved') {
        this.attempConnection(data.server)
      }
    });
  }

  ionViewDidLeave() {
    this.serverProvider.stopWatchForServers();
    this.onConnectSubscription.unsubscribe();
    clearTimeout(this.troubleshootingDialogTimeout);
  }

  async onSkipClicked() {
    this.firebaseAnalytics.logEvent('welcome', {});

    let alert = this.alertCtrl.create({
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
          }
        }
      ]
    });
    alert.present();
  }

  onNextClicked() {
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

  startScanningClicked() {
    this.firebaseAnalytics.logEvent('welcome', {});
    this.navCtrl.setRoot(ScanSessionsPage);
  }

  onSlideChanged() {
    this.showNext = !this.slider.isEnd();
    if (this.slider.isEnd()) {
      this.scheduleShowTroubleshootingDialog();
      this.utils.askWiFiEnableIfDisabled();
    }
  }

  getWebSiteName() {
    return Config.WEBSITE_NAME;
  }

  attempConnection(server: ServerModel) {
    if (this.connecting) {
      this.slider.slideTo(this.slider.length() - 1);
      this.currentAttemptingServer = server;
      this.serverProvider.connect(server)
      this.scheduleShowTroubleshootingDialog();
    }
  }

  scheduleShowTroubleshootingDialog() {
    if (this.troubleshootingDialogTimeout) clearTimeout(this.troubleshootingDialogTimeout);

    this.troubleshootingDialogTimeout = setTimeout(async () => {
      if (this.connecting) {
        let alert = this.alertCtrl.create({
          title: await this.utils.text('connectionTakingTooLongDialogTitle'),
          message: await this.utils.text('connectionTakingTooLongDialogMessage'),
          buttons: [
            {
              text: await this.utils.text('connectionTakingTooLongCancelButton'),
              role: 'cancel',
              handler: () => { }
            },
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
              handler: () => {
                this.iab.create(Config.URL_INSTRUCTIONS, '_system');
              }
            }
          ]
        });
        alert.present();
      }
    }, 1000 * 25) // 25 secs
  }
}
