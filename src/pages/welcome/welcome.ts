import { ServerModel } from './../../models/server.model';
import { ScanModel } from './../../models/scan.model';
import { Component } from '@angular/core';
import { Network } from '@ionic-native/network';
import { NavController, Slides, ViewController, AlertController } from 'ionic-angular';
import { ViewChild, NgZone } from '@angular/core';
import { ScanSessionsPage } from '../scan-sessions/scan-sessions';
import { ServerProvider } from '../../providers/server'
import { Config } from '../../providers/config'
import { Settings } from '../../providers/settings'
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { wsEvent } from '../../models/ws-event.model';

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
  @ViewChild('welcome') slider: Slides;
  public showNext = true;
  public connecting = true;
  public connected = false;

  private enableWifiShown = false;
  private troubleshootingDialogTimeout = null;
  public lastServerAttempted: ServerModel;

  constructor(
    private alertCtrl: AlertController,
    public navCtrl: NavController,
    private serverProvider: ServerProvider,
    public viewCtrl: ViewController,
    private settings: Settings,
    private ngZone: NgZone,
    private ga: GoogleAnalytics,
    private barcodeScanner: BarcodeScanner,
    private network: Network,
  ) { }

  ionViewDidEnter() {
    this.ga.trackView("WelcomePage");
  }

  ionViewDidLeave() {
    clearTimeout(this.troubleshootingDialogTimeout);
  }

  ionViewDidLoad() {
    this.viewCtrl.willLeave.subscribe(() => {
      this.serverProvider.unwatch();
    })

    this.serverProvider.watchForServers().subscribe(data => {
      if (data.action == 'added' || data.action == 'resolved') {
        this.attempConnection(data.server)
      }
    });
  }

  onSkipClicked() {
    this.ga.trackEvent('connectivity', 'server_discovery', 'welcome', 0);

    let alert = this.alertCtrl.create({
      inputs: [
        {
          type: 'checkbox',
          label: 'Do not show anymore',
          value: 'alwaysSkipWelcomePage',
          checked: false
        }
      ],
      buttons: [
        {
          text: 'Skip',
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
    }).then((scan: ScanModel) => {
      if (scan && scan.text) {
        let servers = ServerModel.serversFromJSON(scan.text);
        servers.forEach(server => {
          this.attempConnection(server);
        })
      }
    }, err => { });
  }

  startScanningClicked() {
    this.ga.trackEvent('connectivity', 'server_discovery', 'welcome', 1);
    this.navCtrl.setRoot(ScanSessionsPage);
  }

  onSlideChanged() {
    this.showNext = !this.slider.isEnd();
    if (this.slider.isEnd()) {
      this.scheduleShowTroubleshootingDialog(40);

      if (this.network.type != 'ethernet' && this.network.type != 'wifi' && !this.enableWifiShown) {
        this.alertCtrl.create({
          title: 'Wi-Fi is disabled',
          message: 'Please connect your smartphone to a Wi-Fi network (or ethernet)',
          buttons: [
            {
              text: 'Ok',
              handler: () => { }
            }
          ]
        }).present();
        this.enableWifiShown = true;
      }
    }
  }

  getWebSiteName() {
    return Config.WEBSITE_NAME;
  }

  attempConnection(server: ServerModel) {
    if (this.connecting) {
      this.slider.slideTo(this.slider.length() - 1);
      this.lastServerAttempted = server;
      this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
        if (event.name == wsEvent.EVENT_OPEN && !this.connected) {
          // console.log('connection opened with the server: ', server);
          this.serverProvider.unwatch();
          this.settings.setDefaultServer(server);
          this.slider.slideTo(this.slider.length() - 1);
          this.ngZone.run(() => {
            this.connecting = false;
            this.showNext = false;
          });
          this.connected = true;
        }
      });

      this.serverProvider.connect(server)
      this.scheduleShowTroubleshootingDialog(20);
    }
  }

  scheduleShowTroubleshootingDialog(secs) {
    if (this.troubleshootingDialogTimeout) clearTimeout(this.troubleshootingDialogTimeout);

    this.troubleshootingDialogTimeout = setTimeout(() => {
      if (this.connecting) {
        let alert = this.alertCtrl.create({
          title: 'The connection is taking too long',
          message: 'Your firewall/antivirus may keep the app from connecting, would you like to see the instructions to configure your computer?',
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
              handler: () => { }
            },
            {
              text: 'View instructions',
              handler: () => {
                window.open(Config.URL_INSTRUCTIONS, '_blank');
              }
            }
          ]
        });
        alert.present();
      }
    }, 1000 * secs)
  }
}
