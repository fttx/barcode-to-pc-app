import { Component } from '@angular/core';
import { Device } from '@ionic-native/device';
import { ActionSheetController, AlertController, NavController, NavParams } from 'ionic-angular';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { requestModelPutScanSessions } from '../../models/request.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { Utils } from '../../providers/utils';
import { Subscription } from 'rxjs';
import { responseModel, responseModelPutScanAck } from '../../models/response.model';

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
    private firebaseAnalytics: FirebaseAnalytics,
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
    this.firebaseAnalytics.setCurrentScreen('ArchivedPage');

    this.scanSessionsStorage.getArchivedScanSessions().then(data => {
      this.archivedScanSessions = data;
    });
  }

  ionViewDidLoad() {
  }

  onScanSessionClick(scanSession: ScanSessionModel, index: number) {
    let alert = this.actionSheetCtrl.create({
      buttons: [
        {
          text: 'Delete permanently',
          icon: 'trash',
          handler: () => {
            this.archivedScanSessions = this.archivedScanSessions.filter(x => x != scanSession);
            this.scanSessionsStorage.setArchivedScanSessions(this.archivedScanSessions);
          }
        },
        {
          text: 'Restore',
          icon: 'refresh',
          handler: async () => {
            this.scanSessionsStorage.updateScanSession(scanSession);
            this.archivedScanSessions = this.archivedScanSessions.filter(x => x != scanSession);
            this.scanSessionsStorage.setArchivedScanSessions(this.archivedScanSessions);

            if (this.serverProvider.isConnected()) {
              let wsRequest = new requestModelPutScanSessions().fromObject({
                scanSessions: [scanSession],
                sendKeystrokes: false,
                deviceId: this.device.uuid,
              });
              this.serverProvider.send(wsRequest);
            } else {
              // Undo the archieved flag for the scan session, so it won't get delete from the server
              for (let i = 0; i < scanSession.syncedWith.length; i++) {
                const serverUUID = scanSession.syncedWith[i];
                let deletedIds = await this.settings.getUnsyncedDeletedScanSesions(serverUUID);
                deletedIds = deletedIds.filter(x => x != scanSession.id);
                this.settings.setUnsyncedDeletedScanSesions(serverUUID, deletedIds);
              }

              // Add the scan session to the unsynced restored list, so that it'll be restored automatically
              // once the app connects to the first server that is available
              let restoredIds = await this.settings.getUnsyncedRestoredScanSesions();
              restoredIds.push(scanSession.id);
              this.settings.setUnsyncedRestoredScanSesions(restoredIds);

              let alert = this.alertCtrl.create({
                title: 'Offline mode',
                message: 'The scan sessions will be restored also on the server when it will be connected.\n\nTo trigger the Keyboard Emulation and the CSV output, use the Sync button inside the scan session page.',
                buttons: [
                  {
                    text: 'Ok',
                    role: 'cancel'
                  }]
              });
              alert.present();
            }
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
