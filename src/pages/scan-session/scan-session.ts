import { Component } from '@angular/core';
import { NavParams } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ActionSheetController } from 'ionic-angular'
import { AlertController } from 'ionic-angular'
import { BarcodeScanner } from 'ionic-native';

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
  public askAddMore = false;
  //public enableReoderd = false;

  constructor(private navParams: NavParams, public actionSheetCtrl: ActionSheetController, private alertCtrl: AlertController) {
    this.scanSession = navParams.get('scanSession');
    this.askAddMore = navParams.get('askAddMore');
  }

  ionViewDidLoad() {
    if (this.askAddMore) {
      this.showAddMoreDialog();
    }
  }

  showAddMoreDialog() {
    let alert = this.alertCtrl.create({
      title: 'Continue scanning?',
      message: 'Do you want to add another item to this scan session?',
      buttons: [
        {
          text: 'Stop',
          role: 'cancel',
          handler: () => {
            console.log('Cancel clicked');
          }
        },
        {
          text: 'Continue',
          handler: () => {
            // Infilare tutto in un provider in modo che si utilizza lo stesso codice sia qui che su scannings.ts
            BarcodeScanner.scan({
              "showFlipCameraButton": true, // iOS and Android
              "prompt": "Place a barcode inside the scan area", // supported on Android only
              //"orientation": "landscape" // Android only (portrait|landscape), default unset so it rotates with the device
            }).then((barcodeData) => {
              if (barcodeData && barcodeData.text) {
                this.scanSession.scannings.push(barcodeData);
                this.showAddMoreDialog();
              }
            }, (err) => { });
          }
        }
      ]
    });
    alert.present();

  }

  onItemClick() {
    let actionSheet = this.actionSheetCtrl.create({
      buttons: [{
        text: 'Delete',
        icon: 'trash',
        role: 'destructive',
        handler: () => {
          console.log('Destructive clicked');
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
          console.log('Retake clicked');
        }
      }, {
        text: 'Cancel',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
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
}
