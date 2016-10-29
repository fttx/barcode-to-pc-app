import { Component } from '@angular/core';
import { NavParams } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ActionSheetController } from 'ionic-angular'
import { AlertController } from 'ionic-angular'
import { BarcodeScanner } from 'ionic-native';
import { CameraScannerProvider } from '../../providers/camera-scanner'
import { ServerProvider } from '../../providers/server'
import { ScanModel } from '../../models/scan.model'
import { NavController } from 'ionic-angular';

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
  private startScanning = false;

  constructor(
    private navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    public navCtrl: NavController,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.startScanning = navParams.get('startScanning');
    this.CameraScannerProvider = new CameraScannerProvider();
  }

  ionViewDidLoad() {
    if (this.startScanning) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    }
  }

  scan() {
    this.CameraScannerProvider.scan().then(
      (scan: ScanModel) => {
        this.scanSession.scannings.push(scan);
        this.serverProvider.send(scan);
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
          console.log('Cancel clicked');
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
              this.serverProvider.send(scan);
            });
        }
      }, {
        text: 'Cancel',
        role: 'cancel'
      }]
    });
    actionSheet.present();
  } // onItemClick

  remove(scan) {

  }

  reorderItems(indexes) {
    let element = this.scanSession.scannings[indexes.from];
    this.scanSession.scannings.splice(indexes.from, 1);
    this.scanSession.scannings.splice(indexes.to, 0, element);
  }

   onAddClick() {
    this.scan();
  }
}
