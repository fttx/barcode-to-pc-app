import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { Component } from '@angular/core';
import { NavParams, ModalController } from 'ionic-angular';
import { SocialSharing } from '@ionic-native/social-sharing';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ActionSheetController } from 'ionic-angular'
import { AlertController } from 'ionic-angular'
import { CameraScannerProvider } from '../../providers/camera-scanner';
import { ServerProvider } from '../../providers/server'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { ScanModel } from '../../models/scan.model'
import { NavController } from 'ionic-angular';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session'
import { SelectScanningModePage } from "./select-scanning-mode/select-scanning-mode";
import { NativeAudio } from '@ionic-native/native-audio';
import { requestModelDeleteScan, requestModelPutScan, requestModelDeleteScanSession, requestModelPutScanSession } from '../../models/request.model';
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
  private isNewSession = false;
  private isSynced = false;

  public repeatInterval;
  public repeatAllTimeout = null;
  public next = -1;
  public isRepeating: 'paused' | true | false = false;


  constructor(
    navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    public navCtrl: NavController,
    private scanSessionsStorage: ScanSessionsStorage,
    public modalCtrl: ModalController,
    private googleAnalytics: GoogleAnalyticsService,
    private settings: Settings,
    private socialSharing: SocialSharing,
    private cameraScannerProvider: CameraScannerProvider,
    private nativeAudio: NativeAudio,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.isNewSession = navParams.get('isNewSession');
    this.nativeAudio.preloadSimple('beep', 'assets/audio/beep.ogg');

  }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("ScanSessionPage");
  }

  ionViewDidLoad() {
    if (this.isNewSession && !this.isSynced) {
      let wsRequest = new requestModelPutScanSession().fromObject({
        scanSession: this.scanSession,
      });
      this.serverProvider.send(wsRequest);

      this.isSynced = true;
    }

    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    }
  }

  ionViewDidLeave() {
    this.nativeAudio.unload('beep');
  }

  scan() { // Called when the user want to scan (except for retake scan)
    let selectScanningModeModal = this.modalCtrl.create(SelectScanningModePage);
    selectScanningModeModal.onDidDismiss(mode => {

      // if the user doesn't choose the mode (clicks cancel) and didn't enter the scan-session page
      if (!mode && this.isNewSession) {
        this.destroyScanSession();
        return;
      }

      if (mode == SelectScanningModePage.SCAN_MODE_SINGLE) {
        this.cameraScannerProvider.scan().then(
          (scan: ScanModel) => {
            this.onScan(scan);
          }, err => {
            if (this.scanSession.scannings.length == 0) {
              this.destroyScanSession();
            }
          });
      } else if (mode == SelectScanningModePage.SCAN_MODE_CONTINUE) {
        this.continueScan();
      }
    });
    selectScanningModeModal.present();
  }

  onScan(scan: ScanModel) {
    this.googleAnalytics.trackEvent('scannings', 'scan');
    this.scanSession.scannings.unshift(scan);
    this.save();
    this.sendPutScan(scan);
  }

  continueScan() {
    this.cameraScannerProvider.scan().then(
      (scan: ScanModel) => {
        this.onScan(scan);
        this.showAddMoreDialog();
      }, err => {
        if (this.scanSession.scannings.length == 0) {
          this.destroyScanSession();
        } else {
          if (this.isNewSession) {
            this.setName();
            this.isNewSession = false;
          }
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

  onItemClicked(scan: ScanModel, scanIndex: number) {
    this.googleAnalytics.trackEvent('scannings', 'repeat');
    this.repeat(scan);
  }

  onItemPressed(scan: ScanModel, scanIndex: number) {
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
        this.socialSharing.share(scan.text, "", "", "")
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
      text: 'Repeat from here',
      icon: 'refresh',
      handler: () => {
        this.googleAnalytics.trackEvent('scannings', 'repeatAll');
        if (this.isRepeating == false) {
          this.repeatAll(scanIndex);
        }
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

  sendPutScan(scan: ScanModel, sendKeystrokes = true) {
    let wsRequest = new requestModelPutScan().fromObject({
      scan: scan,
      scanSessionId: this.scanSession.id,
      sendKeystrokes: sendKeystrokes
    });

    this.serverProvider.send(wsRequest);
  }

  sendDeleteScan(scan: ScanModel) {
    let wsRequest = new requestModelDeleteScan().fromObject({
      scan: scan,
      scanSessionId: this.scanSession.id,
    });
    this.serverProvider.send(wsRequest);
  }

  destroyScanSession() {
    if (this.isSynced) {
      let wsRequest = new requestModelDeleteScanSession().fromObject({
        scanSessionId: this.scanSession.id,
      });
      this.serverProvider.send(wsRequest);
    }
    this.navCtrl.pop();
  }

  repeat(scan: ScanModel) {
    // let repeatedScan: ScanModel = Object.assign({}, scan);
    // repeatedScan.repeated = true;

    scan.repeated = true;
    this.sendPutScan(scan);
    this.nativeAudio.play('beep');
  }


  onRepeatAllClicked() {
    this.googleAnalytics.trackEvent('scannings', 'repeatAll');

    this.settings.getRepeatInterval().then(repeatInterval => {
      this.repeatInterval = repeatInterval
    })

    let startFrom = -1;
    if (startFrom == -1) {
      startFrom = this.scanSession.scannings.length - 1;
    }

    if (this.isRepeating === true) {
      this.isRepeating = 'paused';
      if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)
    } else if (this.isRepeating === 'paused') {
      this.isRepeating = true;
      this.repeatAll(this.next);
    } else {
      this.repeatAll(startFrom);
    }
  }



  repeatAll(startFrom = -1) {
    if (startFrom < 0 || startFrom >= this.scanSession.scannings.length) {
      this.stopRepeating();
      return;
    }

    this.isRepeating = true;
    let scan = this.scanSession.scannings[startFrom];

    this.repeat(scan);
    this.next = startFrom - 1;

    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)

    this.repeatAllTimeout = setTimeout(() => {
      if (this.next >= 0) {
        this.repeatAll(this.next);
      } else {
        this.stopRepeating();
      }
    }, this.repeatInterval);
  }

  stopRepeating() {
    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)
    this.repeatAllTimeout = null;
    this.next = -1;
    this.isRepeating = false;
    this.scanSession.scannings.forEach(scan => scan.repeated = false);
  }

  getRepeatAllIcon() {
    if (this.isRepeating === true) {
      return 'pause';
    } else if (this.isRepeating === 'paused') {
      return 'play';
    } else {
      return 'refresh';
    }
  }
}
