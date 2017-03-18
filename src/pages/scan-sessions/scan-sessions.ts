import { Device, Market } from 'ionic-native';
import { Settings } from './../../providers/settings';
import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { Platform, PopoverController, NavController, AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import * as Promise from 'bluebird'

declare var cordova: any;

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  private selectServerShown = false;

  public connected = false;
  public scanSessions: ScanSessionModel[] = [];

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private platform: Platform,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private googleAnalytics: GoogleAnalyticsService,
    private settings: Settings,
  ) { }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("ScanSessionsPage");
    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
    });

    if (this.connected == false) {
      this.settings.getDefaultServer().then(server => {
        this.serverProvider.connect(server).subscribe(
          data => {
            if (data && data.action) {
              this.onMessage(data);
            } else {
              this.onConnect();
            }
          },
          err => this.onDisconnect()
        );
      }, err => {
        if (!this.selectServerShown) {
          this.selectServerShown = true;
          this.navCtrl.push(SelectServerPage)
        }
      })
    }
  }

  onConnect() {
    this.connected = true;
    this.sendPutScanSessions();
    this.serverProvider.send(ServerProvider.ACTION_GET_VERSION);

    Promise.join(this.settings.getNoRunnings(), this.settings.getRated(), (runnings, rated) => {
      if (runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_RATING && !rated) {
        let os = Device.platform;
        let isAndroid = os.toLowerCase().indexOf('android') != -1;
        let store = isAndroid ? 'PlayStore' : 'Appstore';
        this.alertCtrl.create({
          title: 'Rate Barcode to PC',
          message: 'Are you enjoying Barcode to PC?<br><br>Please, rate it on the ' + store + ', it would be appreciated!',
          buttons: [{
            text: 'Remind me later',
            role: 'cancel'
          }, {
            text: 'No',
            handler: () => {
              this.settings.setRated(true);
            }
          }, {
            text: 'Rate',
            handler: () => {
              this.settings.setRated(true);
              if (isAndroid) {
                Market.open('com.barcodetopc');
              } else {
                Market.open('BarcodetoPC:Wi-Fiscanner');
              }
            }
          }]
        }).present();
      }
    });
  }

  onDisconnect() {
    this.connected = false;
  }


  onMessage(message: any) {
    if (message.action == 'getVersion') {
      if (message.data.version != Config.REQUIRED_SERVER_VERSION) {
        this.onVersionMismatch();
      }
    }
  }

  onVersionMismatch() {
    this.alertCtrl.create({
      title: 'Server/app version mismatch',
      message: 'Please update both app and server, otherwise they may not work properly.<br><br>Server can be downloaded at <a href="' + Config.WEBSITE_URL + '">' + Config.WEBSITE_NAME + '</a>',
      buttons: [
        {
          text: 'Ok',
          role: 'cancel'
        }
      ]
    }).present();
  }

  onSelectServerClick() {
    this.navCtrl.push(SelectServerPage);
  }

  onItemSelected(scanSession) {
    this.navCtrl.push(ScanSessionPage, { scanSession: scanSession, isNewSession: false });
  }

  delete(scanSession, index) {
    this.alertCtrl.create({
      title: 'Confirm delete',
      message: 'Do you really want to delete ' + scanSession.name + '?',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          this.scanSessions.splice(index, 1);
          this.save();
          this.sendDeleteScanSessions(scanSession);
        }
      }]
    }).present();
  }

  onAddClick() {
    let date: Date = new Date();
    let newScanSession: ScanSessionModel = {
      id: date.getTime().toString(),
      name: 'Scan session ' + (this.scanSessions.length + 1),
      date: date,
      scannings: []
    };
    this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, isNewSession: true });
  }

  sendPutScanSessions() {
    this.serverProvider.send(ServerProvider.ACTION_PUT_SCANSESSIONS, this.scanSessions)
  }

  sendDeleteScanSessions(scanSession: ScanSessionModel) {
    this.serverProvider.send(ServerProvider.ACTION_DELETE_SCANSESSION, scanSession)
  }

  save() {
    this.scanSessionsStorage.setScanSessions(this.scanSessions);
  }
}