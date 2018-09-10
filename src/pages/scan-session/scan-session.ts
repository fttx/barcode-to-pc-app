import { Component, HostListener, NgZone } from '@angular/core';
import { Device } from '@ionic-native/device';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { NativeAudio } from '@ionic-native/native-audio';
import { SocialSharing } from '@ionic-native/social-sharing';
import { ActionSheetController, AlertController, ModalController, NavController, NavParams, Platform } from 'ionic-angular';

import {
  requestModelDeleteScan,
  requestModelDeleteScanSessions,
  requestModelPutScanSessions,
  requestModelUpdateScanSession,
} from '../../models/request.model';
import { responseModel, responseModelPutScanAck } from '../../models/response.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanModel } from '../../models/scan.model';
import { CameraScannerProvider } from '../../providers/camera-scanner';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session';
import { SelectScanningModePage } from './select-scanning-mode/select-scanning-mode';

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
  private newScanDate: number;
  private lastScanSessionName: string = null;

  public repeatInterval = Config.DEFAULT_REPEAT_INVERVAL;
  public repeatAllTimeout = null;
  public next = -1;
  public isRepeating: 'paused' | true | false = false;

  public keyboardBuffer = '';

  constructor(
    navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    public navCtrl: NavController,
    private scanSessionsStorage: ScanSessionsStorage,
    public modalCtrl: ModalController,
    private ga: GoogleAnalytics,
    private settings: Settings,
    private socialSharing: SocialSharing,
    private cameraScannerProvider: CameraScannerProvider,
    private nativeAudio: NativeAudio,
    private ngZone: NgZone,
    private device: Device,
    private platform: Platform,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.isNewSession = navParams.get('isNewSession');
    this.nativeAudio.preloadSimple('beep', 'assets/audio/beep.ogg');

  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    console.log(event)
    if (event.keyCode == 13) {
      let scan = new ScanModel();
      let now = new Date().getTime();
      scan.cancelled = false;
      scan.id = now;
      scan.date = now;
      scan.repeated = false;
      scan.text = this.keyboardBuffer;
      this.keyboardBuffer = '';
      this.onScan(scan);
    } else {
      this.keyboardBuffer += event.key;
    }
  }

  private responseSubscription = null;
  ionViewDidEnter() {
    this.ga.trackView("ScanSessionPage");
    this.responseSubscription = this.serverProvider.onResponse().subscribe(message => {
      this.ngZone.run(() => {
        if (message.action == responseModel.ACTION_PUT_SCAN_ACK) {
          let response: responseModelPutScanAck = message;
          if (this.scanSession.id == response.scanSessionId) {
            let len = this.scanSession.scannings.length;
            for (let i = (len - 1); i >= 0; i--) {
              if (this.scanSession.scannings[i].id == response.scanId) {
                this.scanSession.scannings[i].ack = true;
                // this.scanSession.scannings[i].repeated = false;
              }
            }
          }
        }
      });
    })
  }

  ionViewDidLoad() {
    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    }
  }

  ionViewDidLeave() {
    this.nativeAudio.unload('beep');
    if (this.responseSubscription != null && this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }
  }

  ionViewWillLeave() {
    this.save();
  }

  scan() { // Called when the user want to scan (except for retake scan)
    let selectScanningModeModal = this.modalCtrl.create(SelectScanningModePage, { showCreateEmptyScanSession: this.isNewSession });
    selectScanningModeModal.onDidDismiss(mode => {

      // if the user doesn't choose the mode (clicks cancel) and didn't enter the scan-session page
      if (!mode && this.isNewSession && this.scanSession.scannings.length == 0) {
        return;
      }

      if (mode == SelectScanningModePage.SCAN_MODE_SINGLE) {
        this.singleScan();
      } else if (mode == SelectScanningModePage.SCAN_MODE_CONTINUE) {
        this.continueScan();
      } else if (mode == SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY) {
        this.addManually();
      }
    });
    selectScanningModeModal.present();
  }

  onScan(scan: ScanModel) {
    this.ga.trackEvent('scannings', 'scan');
    this.scanSession.scannings.unshift(scan);
    this.save();
    // console.log('onScan -> newScanDate = now()')
    this.newScanDate = new Date().getTime();
    // console.log('onScan -> sendPutScan')    
    this.sendPutScan(scan);
  }

  singleScan() {
    this.cameraScannerProvider.scan(false).subscribe(
      (scan: ScanModel) => {
        this.onScan(scan);
        if (this.isNewSession) {
          this.setName();
        }
      }, err => {
        if (this.scanSession.scannings.length == 0) {
          this.navCtrl.pop();
        }
      });
  }

  continueScan() {
    this.cameraScannerProvider.scan(true).subscribe(
      (scan: ScanModel) => {
        this.onScan(scan);
        if (!this.platform.is('android')) {
          this.showAddMoreDialog();
        }
      }, err => {
        if (this.scanSession.scannings.length == 0) {
          this.navCtrl.pop();
        } else {
          if (this.isNewSession) {
            this.setName();
          }
        }
      });
  }

  addManually() {
    const alert = this.alertCtrl.create({
      title: 'Add a scan manually',
      inputs: [
        {
          name: 'text',
          placeholder: 'Text to send',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: data => {  // called also when backdropDismiss occours
            this.navCtrl.pop();
          }
        },
        {
          text: 'Add',
          handler: data => {
            let scan = new ScanModel();
            let now = new Date().getTime();
            scan.cancelled = false;
            scan.id = now;
            scan.repeated = false;
            scan.text = data.text;
            scan.date = now;
            this.onScan(scan);
            if (this.isNewSession) {
              this.setName();
            }
          }
        }
      ]
    });
    alert.present();
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
        this.ga.trackEvent('scannings', 'custom_timeout', null, timeoutSeconds);
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
    if (scan.ack == true) {
      this.alertCtrl.create({
        title: 'The server has already received this scan',
        message: 'Do you want to send it again?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => { }
          },
          {
            text: 'Send again',
            handler: () => {
              this.repeat(scan);
            }
          }
        ]
      }).present();
    } else {
      this.repeat(scan);
    }
    this.ga.trackEvent('scannings', 'repeat');
  }

  onItemPressed(scan: ScanModel, scanIndex: number) {
    let buttons = [];

    buttons.push({
      text: 'Delete',
      icon: 'trash',
      role: 'destructive',
      handler: () => {
        this.ga.trackEvent('scannings', 'delete');
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
        this.ga.trackEvent('scannings', 'share');
        this.socialSharing.share(scan.text, "", "", "")
      }
    });

    if (scan.text.indexOf('http') == 0) {
      buttons.push({
        text: 'Open in browser',
        icon: 'open',
        handler: () => {
          this.ga.trackEvent('scannings', 'open_browser');
          window.open(scan.text, '_blank');
        }
      });
    }

    buttons.push({
      text: 'Repeat from here',
      icon: 'refresh',
      handler: () => {
        this.ga.trackEvent('scannings', 'repeatAll');
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

  onEditClick() {
    if (!this.serverProvider.isConnected()) {
      this.alertCtrl.create({
        title: 'Cannot perform this action offline',
        message: 'Please connect the app to the computer',
        buttons: [{
          text: 'Close',
          role: 'cancel',
        }]
      }).present();
      return;
    }
    this.ga.trackEvent('scannings', 'edit_scan');
    let editModal = this.modalCtrl.create(EditScanSessionPage, this.scanSession);
    editModal.onDidDismiss(scanSession => {
      this.scanSession = scanSession;
      this.sendUpdateScanSession(this.scanSession);
      this.save();
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
            this.lastScanSessionName = this.scanSession.name;
            this.scanSession.name = data.name;
            this.sendUpdateScanSession(this.scanSession);
            this.save();
          }
        }
      }]
    }).present();
    this.isNewSession = false;
  }

  onAddClicked() {
    this.scan();
  }

  save() {
    if (this.isPristine()) {
      return;
    }
    this.scanSessionsStorage.pushScanSession(this.scanSession);
  }

  sendPutScan(scan: ScanModel, sendKeystrokes = true) {
    console.log('sendPutScan, scan.date=', scan.date);
    let scanSession = { ...this.scanSession }; // do a shallow copy (not a deep copy)
    scanSession.scannings = [scan];

    let wsRequest = new requestModelPutScanSessions().fromObject({
      scanSessions: [scanSession],
      sendKeystrokes: sendKeystrokes,
      deviceId: this.device.uuid,
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

  // sendDestroyScanSession(pop = true) {
  //   let wsRequest = new requestModelDeleteScanSessions().fromObject({
  //     scanSessionIds: [this.scanSession.id],
  //   });
  //   this.serverProvider.send(wsRequest);
  //   if (pop) {
  //     this.navCtrl.pop();
  //   }
  // }

  sendUpdateScanSession(updatedScanSession: ScanSessionModel) {
    let request = new requestModelUpdateScanSession().fromObject({
      scanSessionId: this.scanSession.id,
      scanSessionName: this.scanSession.name,
      scanSessionDate: updatedScanSession.date
    });
    this.serverProvider.send(request);
  }

  repeat(scan: ScanModel, setRepeated: boolean = true) {
    // let repeatedScan: ScanModel = Object.assign({}, scan);
    // repeatedScan.repeated = true;
    if (this.skipAlreadySent && scan.ack) {
      return;
    }
    if (setRepeated) {
      scan.repeated = true;
    }
    this.sendPutScan(scan);
    this.nativeAudio.play('beep');
  }


  private skipAlreadySent = false;

  onRepeatAllClicked() {
    this.ga.trackEvent('scannings', 'repeatAll');

    let alert = this.alertCtrl.create({
      title: 'Send all barcodes again',
      inputs: [
        {
          type: 'checkbox',
          label: 'Skip the already sent ones',
          value: 'skipAlreadySent',
          checked: true
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: data => { }
        },
        {
          text: 'Send',
          handler: data => {
            this.skipAlreadySent = (data == 'skipAlreadySent')


            this.settings.getRepeatInterval().then(repeatInterval => {
              if (repeatInterval && repeatInterval != null) {
                this.repeatInterval = repeatInterval;
              }

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
            })


          }
        }
      ]
    });
    alert.present();
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
    this.skipAlreadySent = false;
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

  private isPristine() {
    let neverScanned = !this.scanSession || (this.scanSession.scannings.length == 0 && this.isNewSession);
    let hasBeenRenamed = this.lastScanSessionName && this.lastScanSessionName != this.scanSession.name;
    return neverScanned && !hasBeenRenamed;
  }
}
