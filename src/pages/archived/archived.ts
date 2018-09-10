import { Component } from '@angular/core';
import { Device } from '@ionic-native/device';
import { ActionSheetController, AlertController, NavController, NavParams } from 'ionic-angular';

import { GoogleAnalytics } from '../../../node_modules/@ionic-native/google-analytics';
import { requestModelPutScanSessions } from '../../models/request.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { Utils } from '../../providers/utils';

/**
 * Generated class for the ArchivedPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@Component({
  selector: 'page-archived',
  templateUrl: 'archived.html',
})
export class ArchivedPage {
  public archivedScanSessions: ScanSessionModel[] = [];
  public selectedScanSessions: ScanSessionModel[] = [];


  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private ga: GoogleAnalytics,
    public actionSheetCtrl: ActionSheetController,
    private scanSessionsStorage: ScanSessionsStorage,
    private serverProvider: ServerProvider,
    private settings: Settings,
    private alertCtrl: AlertController,
    private utils: Utils,
    public device: Device,
  ) {
  }

  ionViewDidEnter() {
    this.ga.trackView('ArchivedPage');

    this.scanSessionsStorage.getArchivedScanSessions().then(data => {
      this.archivedScanSessions = data;
    });

    console.log('ionViewDidEnter');
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ArchivedPage');
  }

  onScanSessionClick(scanSession, index: number) {
    let alert = this.actionSheetCtrl.create({
      buttons: [
        {
          text: 'Delete permanently',
          handler: () => {
            this.archivedScanSessions = this.archivedScanSessions.filter(x => x != scanSession);
            this.scanSessionsStorage.setArchivedScanSessions(this.archivedScanSessions);
          }
        },
        {
          text: 'Restore',
          handler: () => {
            if (!this.serverProvider.isConnected()) {
              this.utils.showCannotPerformActionOffline();
              return;
            }

            let wsRequest = new requestModelPutScanSessions().fromObject({
              scanSessions: [scanSession],
              sendKeystrokes: false,
              deviceId: this.device.uuid,
            });
            this.serverProvider.send(wsRequest);

            this.scanSessionsStorage.pushScanSession(scanSession);
            this.archivedScanSessions = this.archivedScanSessions.filter(x => x != scanSession);
            this.scanSessionsStorage.setArchivedScanSessions(this.archivedScanSessions);
          }
        },
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => { }
        },
      ]
    });
    alert.present();
  }

  onDeleteSelectedClick() {
    this.alertCtrl.create({
      title: 'Are you sure',
      message: 'The scan sessions will be deleted permanetly',
      buttons: [{
        text: 'Cancel',
        role: 'cancel'
      }, {
        text: 'Delete',
        handler: () => {
          this.archivedScanSessions = [];
          this.scanSessionsStorage.setArchivedScanSessions(this.archivedScanSessions);
        }
      }]
    }).present();
  }
}
