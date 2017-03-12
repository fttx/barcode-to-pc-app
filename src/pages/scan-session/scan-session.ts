import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavParams, ModalController } from 'ionic-angular';
import { SocialSharing } from 'ionic-native';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ActionSheetController } from 'ionic-angular'
import { AlertController } from 'ionic-angular'
import { CameraScannerProvider } from '../../providers/camera-scanner'
import { ServerProvider } from '../../providers/server'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { ScanModel } from '../../models/scan.model'
import { NavController } from 'ionic-angular';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session'
import { SelectScanningModePage } from "./select-scanning-mode/select-scanning-mode";

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
    private googleAnalytics: GoogleAnalyticsService,
    private settings: Settings,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.isNewSession = navParams.get('isNewSession');
    this.CameraScannerProvider = new CameraScannerProvider();
  }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("ScanSessionPage");
  }

  ionViewDidLoad() {
    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    }
  }

  scan() { // Called when the user want to scan (except for retake scan)

    let selectScanningModeModal = this.modalCtrl.create(SelectScanningModePage);
    selectScanningModeModal.onDidDismiss(mode => {

      // if the user doesn't choose the mode (clicks cancel) and didn't enter the scan-session page yet
      if (!mode && this.isNewSession) {
        this.navCtrl.pop();
        return;
      }

      if (mode == SelectScanningModePage.SCAN_MODE_SINGLE) {
        this.CameraScannerProvider.scan().then(
          (scan: ScanModel) => {
            this.saveScan(scan);
          }, err => {
            if (this.scanSession.scannings.length == 0) {
              this.navCtrl.pop();
            }
          });
      } else if (mode == SelectScanningModePage.SCAN_MODE_CONTINUE) {
        this.continueScan();
      }
    });
    selectScanningModeModal.present();
  }

  saveScan(scan) {
    this.googleAnalytics.trackEvent('scannings', 'scan');
    this.scanSession.scannings.unshift(scan);
    this.save();
    this.sendPutScan(scan);
  }

  continueScan() {
    this.CameraScannerProvider.scan().then(
      (scan: ScanModel) => {
        this.saveScan(scan);
        this.showAddMoreDialog();
      }, err => {
        if (this.scanSession.scannings.length == 0) {
          this.navCtrl.pop();
        }
      });
  }

  showAddMoreDialog() {
    let interval = null;

    let alert = this.alertCtrl.create({
      title: 'Continue scanning?',
      message: 'Do you want to add another item to this scan session?',
      buttons: [{
        text: 'Stop',
        role: 'cancel',
        handler: () => {
          if (interval) clearInterval(interval);

          if (this.isNewSession) {
            this.setName();
            this.isNewSession = false;
          }
        }
      }, {
        text: 'Continue',
        handler: () => {
          if (interval) clearInterval(interval);
          this.continueScan();
        }
      }]
    });
    alert.present();

    this.settings.getContinueModeTimeout().then(timeoutSeconds => {
      if (timeoutSeconds == null) {
        timeoutSeconds = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
      } else {
        this.googleAnalytics.trackEvent('scannings', 'custom_timeout', null, timeoutSeconds);
      }

      interval = setInterval(() => {
        alert.setSubTitle('Timeout: ' + timeoutSeconds);
        if (timeoutSeconds == 0) {
          if (interval) clearInterval(interval);
          alert.dismiss();
          this.continueScan();
        }
        timeoutSeconds--;
      }, 1000);
    });
  }

  onPress(scan, scanIndex) {
    let buttons = [];

    buttons.push({
      text: 'Delete',
      icon: 'trash',
      role: 'destructive',
      handler: () => {
        this.googleAnalytics.trackEvent('scannings', 'delete');
        this.scanSession.scannings.splice(scanIndex, 1);
        this.save();
        this.sendDeleteScan(scan);
        if (this.scanSession.scannings.length == 0) {
          // TODO go back and delete scan session
        }
      }
    });

    buttons.push({
      text: 'Share',
      icon: 'share',
      handler: () => {
        this.googleAnalytics.trackEvent('scannings', 'share');
        SocialSharing.share(scan.text, "", "", "")
      }
    });

    if (scan.text.indexOf('http') == 0) {
      buttons.push({
        text: 'Open in browser',
        icon: 'open',
        handler: () => {
          this.googleAnalytics.trackEvent('scannings', 'open_browser');
          window.open(scan.text, '_blank');
        }
      });
    }

    buttons.push({
      text: 'Retake',
      icon: 'refresh',
      handler: () => {
        this.googleAnalytics.trackEvent('scannings', 'retake');
        this.CameraScannerProvider.scan().then(
          (scan: ScanModel) => {
            this.scanSession.scannings.splice(scanIndex, 1, scan);
            this.save();
            this.sendDeleteScan(scan);
            this.sendPutScan(scan);
          });
      }
    });

    buttons.push({
      text: 'Cancel',
      role: 'cancel'
    });

    let actionSheet = this.actionSheetCtrl.create({
      buttons: buttons
    });
    actionSheet.present();
  } // onItemClick

  edit() {
    this.googleAnalytics.trackEvent('scannings', 'edit_scan');
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

  onAddClick() {
    this.scan();
  }

  save() {
    this.scanSessionsStorage.setScanSession(this.scanSession);
  }

  sendPutScan(scan: ScanModel, retakeIndex: number = -1) {
    let dummyScanSession: ScanSessionModel = { // creo una scanSession fittizia che contiene soltanto la scanModel da inviare
      id: this.scanSession.id,
      name: this.scanSession.name,
      date: this.scanSession.date,
      scannings: [scan]
    };
    this.serverProvider.send(ServerProvider.ACTION_PUT_SCAN, dummyScanSession);
  }

  sendDeleteScan(scan: ScanModel) {
    let dummyScanSession: ScanSessionModel = {
      id: this.scanSession.id,
      name: this.scanSession.name,
      date: this.scanSession.date,
      scannings: [scan]
    };
    this.serverProvider.send(ServerProvider.ACTION_DELETE_SCAN, dummyScanSession);
  }
}
