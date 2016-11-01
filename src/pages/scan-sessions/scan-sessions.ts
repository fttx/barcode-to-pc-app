import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { NavController } from 'ionic-angular';
import { ToastController } from 'ionic-angular';
import { AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'

declare var cordova: any;

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html'
})
export class ScanSessionsPage {
  private selectServerShown = false;

  public connected = false;
  public scanSessions: ScanSessionModel[] = [{
    name: 'Scan session 1',
    date: new Date(),
    scannings: [{
      text: 'AAAAAAAAAAAAA',
      format: 'ean'
    }, {
      text: 'BBBBBBBBBBBBBB',
      format: 'iso'
    }, {
      text: 'CCCCCCCCCCCCCCC',
      format: 'ean_v2'
    }, {
      text: 'DDDDDDDDDDDDDDD',
      format: 'ean r'
    }]
  }];

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private toastCtrl: ToastController,
    private platform: Platform
  ) {

  }

  ionViewDidEnter() {
    if (this.connected == false) {
      this.platform.ready().then(() => {
        this.serverProvider.getDefaultServer().then(
          server => {
            this.serverProvider.connect(server).subscribe(
              message => {
                this.connected = true;
                if (!message) { this.toastCtrl.create({ message: 'Connection extablished', duration: 3000 }).present(); }
              },
              err => {
                this.connected = false;
                this.toastCtrl.create({ message: 'Connection failed', duration: 3000 }).present();
              });
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

  onSelectServerClick() {
    this.navCtrl.push(SelectServerPage);
  }

  onItemSelected(scanSession) {
    this.navCtrl.push(ScanSessionPage, { scanSession: scanSession, startScanning: false });
  }

  onAddClick() {
    let newScanSession = {
      name: 'Scan session ' + (this.scanSessions.length + 1),
      date: new Date(),
      scannings: []
    };
    this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, startScanning: true });
  }
}
