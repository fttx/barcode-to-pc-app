import { Component } from '@angular/core';
import { Platform } from 'ionic-angular';
import { NavController } from 'ionic-angular';
import { AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'

declare var cordova: any;

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html'
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
  ) { }

  ionViewDidEnter() {
    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;

    /*  let now = new Date();
      if (this.lastModified.getTime() <= now.getTime() - 1000 * 20) {*/
     /*   this.sync();
      }
      this.lastModified = now;*/
    });

    if (this.connected == false) {
      this.platform.ready().then(() => {
        this.serverProvider.getDefaultServer().then(
          server => {
            this.serverProvider.connect(server).subscribe(
              message => {
                this.connected = true;
                this.sync();
              },
              err => {
                this.connected = false;
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

  sync() {
    this.serverProvider.send(ServerProvider.ACTION_PUT_SCANSESSIONS, this.scanSessions) 
  }
}
