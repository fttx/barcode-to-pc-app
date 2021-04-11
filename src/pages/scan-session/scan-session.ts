import { Component, HostListener, NgZone, ViewChild } from '@angular/core';
import { Device } from '@ionic-native/device';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { NativeAudio } from '@ionic-native/native-audio';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Promise as BluebirdPromise } from 'bluebird';
import { ActionSheetController, AlertController, ModalController, NavController, NavParams, Platform } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { KeyboardInputComponent } from '../../components/keyboard-input/keyboard-input';
import { requestModelDeleteScan, requestModelPutScanSessions, requestModelUpdateScanSession } from '../../models/request.model';
import { responseModel, responseModelPutScanAck } from '../../models/response.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanModel } from '../../models/scan.model';
import { ScanProvider } from '../../providers/scan';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Utils } from '../../providers/utils';
import { SettingsPage } from '../settings/settings';
import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { CSVExportOptionsPage } from './csv-export-options/csv-export-options';
import { EditScanSessionPage } from './edit-scan-session/edit-scan-session';
import { OcrPage } from './ocr/ocr';
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
  private selectedOutputProfileIndex: number;
  private enableBeep = true;

  constructor(
    public navParams: NavParams,
    public actionSheetCtrl: ActionSheetController,
    public alertCtrl: AlertController,
    public serverProvider: ServerProvider,
    public navCtrl: NavController,
    public scanSessionsStorage: ScanSessionsStorage,
    public modalCtrl: ModalController,
    private firebaseAnalytics: FirebaseAnalytics,
    public settings: Settings,
    public socialSharing: SocialSharing,
    public nativeAudio: NativeAudio,
    public ngZone: NgZone,
    public device: Device,
    private utils: Utils,
    public scanProvider: ScanProvider,
    public platform: Platform, // required from the templates
    private iab: InAppBrowser,
  ) {
    this.scanSession = navParams.get('scanSession');
    if (!this.scanSession) {
      this.isNewSession = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    this.ngZone.run(() => {
      if (event.keyCode == 13 && this.keyboardInput.value.length > 0) {
        this.onEnterClick();
      }
    })
  }

  ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen("ScanSessionPage");
    this.responseSubscription = this.serverProvider.onMessage().subscribe(message => {
      if (message.action == responseModel.ACTION_PUT_SCAN_ACK) {
        let response: responseModelPutScanAck = message;
        if (this.scanSession.id == response.scanSessionId) {
          let len = this.scanSession.scannings.length;
          for (let i = (len - 1); i >= 0; i--) {
            if (this.scanSession.scannings[i].id == response.scanId) {
              this.scanSession.scannings[i].ack = true;
              if (response.outputBlocks && response.outputBlocks.length != 0) {
                this.scanSession.scannings[i].outputBlocks = response.outputBlocks;
                this.scanSession.scannings[i].displayValue = ScanModel.ToString(this.scanSession.scannings[i]);
              }
              // this.scanSession.scannings[i].repeated = false;
            }
          }
        }
      }
    });
  }

  ionViewDidLoad() {
    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    } else {
      // It will be shown only once because ioViewDidLoad is always called only once
      BluebirdPromise.join(this.settings.getNoRunnings(), this.settings.getSoundFeedbackOrDialogShown(), this.settings.getEnableBeep(), (runnings, soundFeedbackOrDialogShown, enableBeep) => {
        this.enableBeep = enableBeep;
        if (!soundFeedbackOrDialogShown && runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_SOUND_FEEDBACK_OR_DIALOG) {
          this.alertCtrl.create({
            title: 'Beep sound',
            message: 'If you want to hear a beep sound after the scan, raise your Media volume <b>and</b> also make you sure that the Do not disturb mode is disabled.<br><br>If you want to customize the beep sound, please use the BEEP component in the server settings. <br><br>If instead you want to put a delay between the scans you can set a <b>timeout</b> in the Settings page',
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

  async ionViewWillEnter() {
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
  }

  scan() { // Called when the user want to scan
    let selectScanningModeModal = this.modalCtrl.create(SelectScanningModePage, { scanSession: this.scanSession });
    selectScanningModeModal.onDidDismiss(data => {
      // if the user doesn't choose the mode (clicks cancel)
      if (!data || data.cancelled) {
        // if the user clicked the add FAB outside the scanSession page
        if (this.isNewSession) {
          this.navCtrl.pop();
        }
        return;
      }

      let scanMode = data.scanMode;
      this.scanSession = data.scanSession;
      this.selectedOutputProfileIndex = data.selectedOutputProfileIndex;

      if (this.scanProviderSubscription != null) {
        this.scanProviderSubscription.unsubscribe();
      }
      this.scanProviderSubscription = this.scanProviderSubscription = this.scanProvider.scan(scanMode, this.selectedOutputProfileIndex, this.scanSession, this.keyboardInput).subscribe(
        scan => {
          this.saveAndSendScan(scan);
          this.isNewSession = false;
        },
        err => {
          console.log('err')
          // if the user clicks cancel without acquiring not even a single barcode
          if (!this.isNewSession && this.scanSession.scannings.length == 0) {
            this.navCtrl.pop()
          }
        },
        () => { // onComplete
          if (this.isNewSession) {
            if (this.scanSession.scannings.length == 0) {
              this.navCtrl.pop();
            }
          }
        }
      )
    }); // onDidDismiss
    selectScanningModeModal.present();
  }

  // This method can't be moved inside scan.ts because there is no way to tell
  // wether the subscription is still active from inside that file
  keyboardInputTouchStart(event) {
    // We prevent default, because we don't know if the Output Template  starts
    // with a BARCODE component, so we don't want the keyboard to pop out.
    // The input element will be focussed by the scanProvider.scan() as it runs
    // the outputProfile.
    //
    // There is an exception: since copy & paste doesn't work in combination
    // with preventDefault we do allow the event to pass only when the field has
    // already been focussed from the scanProvider.
    if (!this.keyboardInput.isFocussed()) {
      event.preventDefault();
      event.stopPropagation();
    }

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

    this.scanProviderSubscription = this.scanProvider.scan(SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY, this.selectedOutputProfileIndex, this.scanSession, this.keyboardInput).subscribe(
      scan => this.saveAndSendScan(scan),
      err => {
        // if the user clicks cancel without acquiring not even a single barcode
        if (!this.isNewSession && this.scanSession.scannings.length == 0) {
          this.navCtrl.pop()
        }
      },
      // complete
      () => {
        this.scanProviderSubscription.unsubscribe();
        this.scanProviderSubscription = null;
      }
    )
  }

  saveAndSendScan(scan: ScanModel) {
    this.firebaseAnalytics.logEvent('scan', {});
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
    this.firebaseAnalytics.logEvent('repeat', {});
  }

  onItemPressed(scan: ScanModel, scanIndex: number) {
    let buttons = [];

    buttons.push({
      text: 'Delete', icon: 'trash', role: 'destructive', handler: () => {
        this.firebaseAnalytics.logEvent('delete', {});
        this.alertCtrl.create({
          title: 'Are you sure?',
          message: 'The the scan will be deleted only from the smartphone.',
          buttons: [{
            text: 'Cancel', role: 'cancel'
          }, {
            text: 'Delete', handler: () => {
              this.scanSession.scannings.splice(scanIndex, 1);
              this.save();
              this.sendDeleteScan(scan);
              if (this.scanSession.scannings.length == 0) {
                // TODO go back and delete scan session
              }
            }
          }]
        }).present();
      }
    });

    let scanString = ScanModel.ToString(scan);
    buttons.push({
      text: 'Share', icon: 'share', handler: () => {
        this.firebaseAnalytics.logEvent('share', {});
        this.socialSharing.share(scanString, "", "", "")
      }
    });

    if (scanString.toLocaleLowerCase().trim().startsWith('http')) {
      buttons.push({
        text: 'Open in browser', icon: 'open', handler: () => {
          this.firebaseAnalytics.logEvent('open_browser', {});
          this.iab.create(scanString, '_system');
        }
      });
    }

    buttons.push({
      text: 'Repeat from here', icon: 'refresh',
      handler: () => {
        this.firebaseAnalytics.logEvent('repeatAll', {});
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
    this.firebaseAnalytics.logEvent('edit_scan', {});
    let editModal = this.modalCtrl.create(EditScanSessionPage, this.scanSession);
    editModal.onDidDismiss(scanSession => {
      this.scanSession = scanSession;
      this.sendUpdateScanSession(this.scanSession);
      this.save();
    });
    editModal.present();
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
    if (this.enableBeep) {
      this.nativeAudio.play('beep');
    }
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
          this.firebaseAnalytics.logEvent('repeatAll', {});

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

    // Waits for the ACK and saves the scan.ack attribute to the scan storage
    setTimeout(() => { this.save() }, 1500);
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

    // Waits for the ACK and saves the scan.ack attribute to the scan storage
    setTimeout(() => { this.save() }, 1500);
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

  onShareClick() {
    let editModal = this.modalCtrl.create(CSVExportOptionsPage, this.scanSession);
    editModal.onDidDismiss(base64CSV => {
      if (!base64CSV) return;
      if (this.utils.isAndroid()) {
        this.socialSharing.share(null, this.scanSession.name, "data:text/csv;base64," + base64CSV, null)
      } else {
        // iOS Quirk: https://github.com/EddyVerbruggen/SocialSharing-PhoneGap-Plugin/issues/778
        this.socialSharing.share(null, this.scanSession.name, "data:text/csv;df:" + this.scanSession.name + ".csv;base64," + base64CSV, null)
      }
    });
    editModal.present();
  }

  onOCRClick() {
    let ocrPage = this.modalCtrl.create(OcrPage);
    ocrPage.onDidDismiss(text => {
      if (!text) return;
      this.keyboardInput.value += text;
      this.keyboardInput.focus();
    });
    ocrPage.present();
  }
}
