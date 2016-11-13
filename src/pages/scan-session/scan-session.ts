import { Component } from '@angular/core';
import { NavParams, ModalController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ActionSheetController } from 'ionic-angular'
import { AlertController } from 'ionic-angular'
import { CameraScannerProvider } from '../../providers/camera-scanner'
import { ServerProvider } from '../../providers/server'
import { ScanModel } from '../../models/scan.model'
import { NavController } from 'ionic-angular';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session'

/*
  Generated class for the Scan page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-scan-session',
  templateUrl: 'scan-session.html'
})
export class ScanSessionPage {
  public scanSession: ScanSessionModel;
  private CameraScannerProvider: CameraScannerProvider;
  private isNewSession = false;

  constructor(
    private navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    public navCtrl: NavController,
    private scanSessionsStorage: ScanSessionsStorage,
    public modalCtrl: ModalController,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.isNewSession = navParams.get('isNewSession');
    this.CameraScannerProvider = new CameraScannerProvider();
  }

  ionViewDidLoad() {
    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    }
  }

  scan() { // Warning! Retake quirk: this function doesn't get called if you selec retake
    this.CameraScannerProvider.scan().then(
      (scan: ScanModel) => {
        this.scanSession.scannings.unshift(scan);
        this.save();
        this.send(scan);
        this.showAddMoreDialog();
      }, err => {
        if (this.scanSession.scannings.length == 0) {
          this.navCtrl.pop();
        }
      });
  }

  showAddMoreDialog() {
    let alert = this.alertCtrl.create({
      title: 'Continue scanning?',
      message: 'Do you want to add another item to this scan session?',
      buttons: [{
        text: 'Stop',
        role: 'cancel',
        handler: () => {
          if (this.isNewSession) {
            this.setName();
            this.isNewSession = false;
          }
        }
      }, {
        text: 'Continue',
        handler: () => {
          this.scan();
        }
      }]
    });
    alert.present();
  }

  onItemClick(scan, scanIndex) {
    let actionSheet = this.actionSheetCtrl.create({
      buttons: [{
        text: 'Delete',
        icon: 'trash',
        role: 'destructive',
        handler: () => {
          this.scanSession.scannings.splice(scanIndex, 1);
          if (this.scanSession.scannings.length == 0) {
            // TODO go back and delete scan session
          }
        }
      }, {
        text: 'Share',
        icon: 'share',
        handler: () => {
          console.log('Share clicked');
        }
      }, {
        text: 'Retake',
        icon: 'refresh',
        handler: () => {
          this.CameraScannerProvider.scan().then(
            (scan: ScanModel) => {
              this.scanSession.scannings.splice(scanIndex, 1, scan);
              // TODO: fare sync prima di inviare il nuovo codice
              this.save();
              this.send(scan, scanIndex);
            });
        }
      }, {
        text: 'Cancel',
        role: 'cancel'
      }]
    });
    actionSheet.present();
  } // onItemClick

  edit() {
    let editModal = this.modalCtrl.create(EditScanSessionPage, this.scanSession);
    editModal.onDidDismiss(scanSession => {
      this.scanSession = scanSession
      this.save();
      // TODO: sync col server
    });
    editModal.present();
  }

  setName() {
    this.alertCtrl.create({
      title: 'Name',
      message: 'Insert a name for this scan session',
      inputs: [{
        name: 'name',
        placeholder: this.scanSession.name
      }],
      buttons: [{
        text: 'Ok',
        handler: data => {
          if (this.scanSession.name != data.name && data.name != "") {
            this.scanSession.name = data.name;
            this.save();
            // TODO: sync
          }
        }
      }]
    }).present();
  }

  remove(scan) {

  }

  onAddClick() {
    this.scan();
  }

  save() {
    this.scanSessionsStorage.setScanSession(this.scanSession);
  }

  send(scan: ScanModel, retakeIndex: number = -1) {
    let dummyScanSession: ScanSessionModel = { // creo una scanSession fittizia che contiene soltanto la scanModel da inviare
      id: this.scanSession.id,
      name: this.scanSession.name,
      date: this.scanSession.date,
      scannings: [scan]
    };
    this.serverProvider.send(ServerProvider.ACTION_PUT_SCAN, dummyScanSession);
  }
}
