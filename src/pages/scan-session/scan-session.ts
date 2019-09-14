import { Component, NgZone, ViewChild } from '@angular/core';
import { Device } from '@ionic-native/device';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { NativeAudio } from '@ionic-native/native-audio';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Promise } from 'bluebird';
import { ActionSheetController, AlertController, ModalController, NavController, NavParams } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { KeyboardInputComponent } from '../../components/keyboard-input/keyboard-input';
import { requestModelDeleteScan, requestModelPutScanSessions, requestModelUpdateScanSession } from '../../models/request.model';
import { responseModel, responseModelPutScanAck } from '../../models/response.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanModel } from '../../models/scan.model';
import { ScanProvider } from '../../providers/scan';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { SettingsPage } from '../settings/settings';
import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session';
import { SelectScanningModePage } from './select-scanning-mode/select-scanning-mode';


/**
 * This page is used to display the list of the barcodes of a specific
 * ScanSession.
 * It also intereacts with the ScanProvider to allow adding more barcodes.
 * In addition it contains a keyboard-input component to provide a way to enter
 * barcodes with the keyboard (both native and OTG)
 */
@Component({
  selector: 'page-scan-session',
  templateUrl: 'scan-session.html'
})
export class ScanSessionPage {
  @ViewChild(KeyboardInputComponent) keyboardInput: KeyboardInputComponent;

  public scanSession: ScanSessionModel;
  public repeatingStatus: 'paused' | 'repeating' | 'stopped' = 'stopped';

  private isNewSession = false;
  private repeatInterval = Config.DEFAULT_REPEAT_INVERVAL;
  private repeatAllTimeout = null;
  private next = -1;
  private responseSubscription: Subscription = null;
  private scanProviderSubscription: Subscription = null;
  private skipAlreadySent = false;

  constructor(
    public navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    public alertCtrl: AlertController,
    public serverProvider: ServerProvider,
    public navCtrl: NavController,
    public scanSessionsStorage: ScanSessionsStorage,
    public modalCtrl: ModalController,
    public ga: GoogleAnalytics,
    public settings: Settings,
    public socialSharing: SocialSharing,
    public nativeAudio: NativeAudio,
    public ngZone: NgZone,
    public device: Device,
    public scanProvider: ScanProvider,
  ) {
    this.scanSession = navParams.get('scanSession');
    this.isNewSession = navParams.get('isNewSession');
    this.nativeAudio.preloadSimple('beep', 'assets/audio/beep.ogg');
  }

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
    } else {
      // It will be shown only once because ioViewDidLoad is always called only once
      Promise.join(this.settings.getNoRunnings(), this.settings.getSoundFeedbackOrDialogShown(), (runnings, soundFeedbackOrDialogShown) => {
        if (!soundFeedbackOrDialogShown && runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_SOUND_FEEDBACK_OR_DIALOG) {
          this.alertCtrl.create({
            title: 'Beep sound',
            message: 'If you want to hear a beep sound after the scan, raise your Media volume <b>and</b> also make you sure that the Ringer volume is not 0. <br><br>If you want to wait a certain amount of time between a scan and another you can set a <b>timeout</b> in the Settings page',
            buttons: [
              { text: 'Open Settings', handler: () => { this.navCtrl.push(SettingsPage) } },
              { text: 'Show later', role: 'cancel', handler: () => { } },
              {
                text: 'Ok, I understand', role: 'cancel', handler: () => { this.settings.setSoundFeedbackOrDialogShown(true); }
              }]
          }).present();

        }
      })
    }
  }

  ionViewDidLeave() {
    this.nativeAudio.unload('beep');
    if (this.responseSubscription != null && this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }

    if (this.scanProviderSubscription && this.scanProviderSubscription != null) {
      this.scanProviderSubscription.unsubscribe();
    }
  }

  ionViewWillLeave() {

  }

  scan() { // Called when the user want to scan
    let selectScanningModeModal = this.modalCtrl.create(SelectScanningModePage, { showCreateEmptyScanSession: this.isNewSession });
    selectScanningModeModal.onDidDismiss(mode => {

      // if the user doesn't choose the mode (clicks cancel) and didn't enter the scan-session page
      if (!mode && this.isNewSession && this.scanSession.scannings.length == 0) {
        this.navCtrl.pop();
        return;
      }

      if (this.scanProviderSubscription != null) {
        this.scanProviderSubscription.unsubscribe();
      }
      this.scanProviderSubscription = this.scanProviderSubscription = this.scanProvider.scan(mode, this.keyboardInput).subscribe(
        scan => this.saveAndSendScan(scan),
        err => {
          console.log('err')
          // if the user clicks cancel without acquiring not even a single barcode
          if (!this.isNewSession && this.scanSession.scannings.length == 0) {
            this.navCtrl.pop()
          }
        },
        () => { // onComplete
          if (this.isNewSession) {
            this.isNewSession = false;
            if (this.scanSession.scannings.length != 0) {
              if (mode == 'continue') {
                this.setName();
              }
            } else {
              this.navCtrl.pop();
            }
          }
        }
      )
    }); // onDidDismiss
    selectScanningModeModal.present();
  }

  // this method can't be moved inside scan.ts because there is no way to tell
  // wether the subscription is still active from inside that file
  keyboardInputTouchStart(event) {
    // we always prevent default, because the input element will be focussed by
    // the scanProvider.scan() as it runs the outputProfile
    event.preventDefault();
    event.stopPropagation();

    if (this.scanProviderSubscription && this.scanProviderSubscription != null) {
      if (this.scanProvider.acqusitionMode == 'manual') {
        // it may happen that for some reason the focus is lost, eg. the user
        // accidentally taps outside the input element while typing it, and he
        // may want to continue typing the barcode, without loosing the
        // outputProfile progress. To resume from that scenario we check if the
        // scanProvider is still waiting for the user to submit the barcode and
        // then restore the focus to the input element
        if (this.scanProvider.awaitingForBarcode) {
          this.keyboardInput.focus();
        }

        // the subscription is already ok, so we don't touch it
        return;
      } else {
        // in this case it means that there was another type of scan going on,
        // so we need to clean up the subscription before creating another
        this.scanProviderSubscription.unsubscribe();
      }
    }

    this.scanProviderSubscription = this.scanProvider.scan(SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY, this.keyboardInput).subscribe(
      scan => this.saveAndSendScan(scan),
      err => {
        // if the user clicks cancel without acquiring not even a single barcode
        if (!this.isNewSession && this.scanSession.scannings.length == 0) {
          this.navCtrl.pop()
        }
      }
      // the manual mode can't a have a complete() event
    )
  }

  saveAndSendScan(scan: ScanModel) {
    this.ga.trackEvent('scannings', 'scan');
    this.scanSession.scannings.unshift(scan);
    this.save();
    this.sendPutScan(scan);
  }

  onItemClicked(scan: ScanModel, scanIndex: number) {
    if (scan.ack == true) {
      this.alertCtrl.create({
        title: 'The server has already received this scan',
        message: 'Do you want to send it again?',
        buttons: [{ text: 'Cancel', role: 'cancel', handler: () => { } },
        { text: 'Send again', handler: () => { this.repeat(scan); } }]
      }).present();
    } else {
      this.repeat(scan);
    }
    this.ga.trackEvent('scannings', 'repeat');
  }

  onItemPressed(scan: ScanModel, scanIndex: number) {
    let buttons = [];

    buttons.push({
      text: 'Delete', icon: 'trash', role: 'destructive', handler: () => {
        this.ga.trackEvent('scannings', 'delete');
        this.scanSession.scannings.splice(scanIndex, 1);
        this.save();
        this.sendDeleteScan(scan);
        if (this.scanSession.scannings.length == 0) {
          // TODO go back and delete scan session
        }
      }
    });

    let scanString = ScanModel.ToString(scan);
    buttons.push({
      text: 'Share', icon: 'share', handler: () => {
        this.ga.trackEvent('scannings', 'share');
        this.socialSharing.share(scanString, "", "", "")
      }
    });

    if (scanString.indexOf('http') == 0) {
      buttons.push({
        text: 'Open in browser', icon: 'open', handler: () => {
          this.ga.trackEvent('scannings', 'open_browser');
          window.open(scanString, '_blank');
        }
      });
    }

    buttons.push({
      text: 'Repeat from here', icon: 'refresh',
      handler: () => {
        this.ga.trackEvent('scannings', 'repeatAll');
        if (this.repeatingStatus == 'stopped') {
          this.repeatAll(scanIndex);
        }
      }
    });

    buttons.push({ text: 'Cancel', role: 'cancel' });

    let actionSheet = this.actionSheetCtrl.create({ buttons: buttons });
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
    return new Promise((resolve, reject) => {
      let alert = this.alertCtrl.create({
        title: 'Name', message: 'Insert a name for this scan session',
        inputs: [{ name: 'name', placeholder: this.scanSession.name }],
        buttons: [{
          text: 'Ok', handler: data => {
            if (this.scanSession.name != data.name && data.name != "") {
              this.scanSession.name = data.name;
              this.sendUpdateScanSession(this.scanSession);
              this.save();
            }
          }
        }]
      });
      alert.onDidDismiss(() => {
        resolve();
      })
      alert.present();
    });
  }

  onAddClicked() {
    this.scan();
  }

  save() {
    this.scanSessionsStorage.updateScanSession(this.scanSession);
  }

  sendPutScan(scan: ScanModel, sendKeystrokes = true) {
    let scanSession = { ...this.scanSession }; // do a shallow copy (copy only the properties of the object first level)
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

  onRepeatAllClick() {
    this.alertCtrl.create({
      title: 'Send all barcodes again',
      inputs: [{
        type: 'checkbox',
        label: 'Skip the already sent ones',
        value: 'skipAlreadySent',
        checked: true
      }],
      buttons: [{
        text: 'Cancel', role: 'cancel', handler: data => { }
      }, {
        text: 'Send', handler: data => {
          this.ga.trackEvent('scannings', 'repeatAll');

          this.skipAlreadySent = (data == 'skipAlreadySent')

          this.settings.getRepeatInterval().then(repeatInterval => {
            if (repeatInterval != null) {
              this.repeatInterval = repeatInterval;
            }

            if (this.repeatingStatus != 'repeating' && this.repeatingStatus != 'paused') {
              let startFrom = this.scanSession.scannings.length - 1;
              this.repeatAll(startFrom);
            }
          })
        }
      }]
    }).present();
  }

  onPauseRepeatingClick() {
    this.repeatingStatus = 'paused';
    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)
  }

  onResumeRepeatingClick() {
    this.repeatingStatus = 'repeating';
    this.repeatAll(this.next);
  }

  stopRepeatingClick() {
    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)
    this.repeatAllTimeout = null;
    this.next = -1;
    this.repeatingStatus = 'stopped';
    this.scanSession.scannings.forEach(scan => scan.repeated = false);
    this.skipAlreadySent = false;
  }

  onEnterClick(event = null) {
    this.keyboardInput.submit();
  }

  private repeatAll(startFrom = -1) {
    if (startFrom < 0 || startFrom >= this.scanSession.scannings.length) {
      this.stopRepeatingClick();
      return;
    }

    this.repeatingStatus = 'repeating';
    let scan = this.scanSession.scannings[startFrom];

    this.repeat(scan);
    this.next = startFrom - 1;

    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)

    this.repeatAllTimeout = setTimeout(() => {
      if (this.next >= 0) {
        this.repeatAll(this.next);
      } else {
        this.stopRepeatingClick();
      }
    }, this.repeatInterval);
  }

}
