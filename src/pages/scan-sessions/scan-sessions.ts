import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { Platform, PopoverController, NavController, AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { AboutPage } from '../about/about'
import { ServerProvider } from '../../providers/server'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'

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
  ) { }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("ScanSessionsPage");
    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
    });

    if (this.connected == false) {
      this.platform.ready().then(() => {
        this.serverProvider.getDefaultServer().then(
          server => {
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
          },
          err => {
            if (!this.selectServerShown) {
              this.selectServerShown = true;
              this.navCtrl.push(SelectServerPage)
            }
          })
      });
    }
  }

  onConnect() {
    this.connected = true;
    this.sendPutScanSessions();
    this.serverProvider.send(ServerProvider.ACTION_GET_VERSION);
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