import { Component, HostListener, NgZone, ViewChild } from '@angular/core';
import { Device } from '@ionic-native/device';
import { File } from '@ionic-native/file';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { NativeAudio } from '@ionic-native/native-audio';
import { NFC } from '@ionic-native/nfc';
import { SocialSharing } from '@ionic-native/social-sharing';
import { Promise as BluebirdPromise } from 'bluebird';
import { ActionSheetController, AlertController, Events, LoadingController, MenuController, ModalController, NavController, NavParams, Platform } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { KeyboardInputComponent } from '../../components/keyboard-input/keyboard-input';
import { OutputBlockModel } from '../../models/output-block.model';
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
import { SelectScanningModePage } from './select-scanning-mode/select-scanning-mode';
import { PhotoViewer } from '@ionic-native/photo-viewer';
import { WebIntent } from '@ionic-native/web-intent';
import { LastToastProvider } from '../../providers/last-toast/last-toast';
import moment from 'moment';

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
  private unregisterBackButton = null;
  private resumeSubscription: Subscription = null;
  private pauseSubscription: Subscription = null;
  private isPaused: boolean = false;
  private realtimeSend: boolean = true;
  private catchUpIOSLag = false;
  private disableKeyboarAutofocus: boolean = false;
  onDisconnectSubscription: Subscription;
  onConnectSubscription: any;

  // BWP::start
  public newItem = false;
  // BWP::end

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
    private file: File,
    public events: Events,
    private nfc: NFC,
    private photoViewer: PhotoViewer,
    private webIntent: WebIntent,
    public menuCtrl: MenuController,
    private lastToast: LastToastProvider,
    public loadingCtrl: LoadingController,
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
      } else if (!this.keyboardInput.isFocussed() && this.scanProvider.awaitingForBarcode && !this.disableKeyboarAutofocus) {
        this.keyboardInputTouchStart(event);
      }

      // Check if the current focussed element is an input element
      // if not, we can write the key to the keyboardInput, otherwise it means
      // that a dialog (eg. number) is visible.
      const currentElement = document.activeElement;
      if (!this.keyboardInput.isFocussed() && (!currentElement || (currentElement && currentElement.tagName != 'INPUT'))) {
        if (event.keyCode >= 32 && event.key.length == 1) {
          this.keyboardInput.value += event.key;
        }
      }
    })
  }

  // BWP::start
  // private static hasShownExitScanModeAlert = false;
  async ionViewCanLeave() {
    // if (!ScanSessionPage.hasShownExitScanModeAlert) {
    //   ScanSessionPage.hasShownExitScanModeAlert = true;
    //   return true;
    // }
    const leave = await new Promise(async resolve => {
      let cbd = 5;
      const title = 'Exit scan mode';
      const alert = this.alertCtrl.create({
        title: title,
        message: 'Do you want to exit scan mode?',
        buttons: [
          {
            text: 'No',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Yes',
            handler: () => resolve(true)
          }
        ]
      });

      alert.setTitle(`${title} (${cbd})`);
      if (cbd != 0) {
        setInterval(() => {
          cbd--;
          alert.setTitle(`${title} (${cbd})`);
          if (cbd == 0) {
            resolve(false);
            alert.dismiss();
          }
        }, 1000);
      }
      alert.present();
    });
    return leave;
  }
  // BWP::end

  async ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen("ScanSessionPage");
    this.responseSubscription = this.serverProvider.onMessage().subscribe(message => {
      if (message.action == responseModel.ACTION_PUT_SCAN_ACK) {
        let response: responseModelPutScanAck = message;
        if (this.scanSession.id == response.scanSessionId) {
          let len = this.scanSession.scannings.length;
          for (let i = (len - 1); i >= 0; i--) {
            if (this.scanSession.scannings[i].id == response.scanId) {
              this.scanSession.scannings[i].ack = true;
              if (response.serverUUID && this.scanSession.syncedWith.indexOf(response.serverUUID) == -1) this.scanSession.syncedWith.push(response.serverUUID);
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

    // Enable back button only if the webview is visible.
    // Otherwise it will go back to the previous page when using the back button
    // to exit the scanner plugin
    // BWP::start
    this.unregisterBackButton = this.platform.registerBackButtonAction(() => {
      if (!this.isPaused) {
        if (this.exitTimeout != null) clearTimeout(this.exitTimeout);
        this.exitTimeout = setTimeout(() => {
          this.exitCounter = 0;
          this.exitTimeout = null;
        }, 1000);
        if (this.exitCounter <= 4) {
          this.lastToast.present(`Press back ${5 - this.exitCounter} times to exit`, 2000);
        } else if (this.exitCounter == 5) {
          this.navCtrl.pop();
        }
        this.exitCounter++;
      }
    }, 0);
    // BWP::end

    // PDA::start
    this.webIntent.registerBroadcastReceiver({
      filterActions: (await this.settings.getPDAIntents()).split(','),
    }).subscribe(intent => {
      let data = null;
      if (intent.extras.hasOwnProperty('com.symbol.datawedge.data_string')) {
        // The Zebra devices use the DataWedge API to send the barcode, and they
        // write the result into the intent.extras["com.symbol.datawedge.data_string"]
        data = intent.extras["com.symbol.datawedge.data_string"];
      } else {
        data = intent.extras.data;
      }

      this.keyboardInput.value = data;
      this.onEnterClick();
    });
    // PDA::end

    // Init the outputTemplate by triggering the touch
    // When the disableKeyboarAutofocus is enabled, the output template is not started
    // so we manually trigger the keyboardInputTouchStart that will subscribe to the
    // barcode scan events.
    // We also check if scanSession is not null because it may be happen that the
    // scanSession hasn't been created yet, since the OutputTemplateSelectorPage
    // may appear first.
    if (this.disableKeyboarAutofocus && !this.scanProviderSubscription && this.scanSession) {
      this.keyboardInputTouchStart(event, false);
    }
  }

  private exitTimeout = null
  private exitCounter = 0;
  private connected = false;


  ionViewWillUnload() {
    if (this.onConnectSubscription != null) {
      this.onConnectSubscription.unsubscribe();
    }
    if (this.onDisconnectSubscription != null) {
      this.onDisconnectSubscription.unsubscribe();
    }
  }


  ionViewDidLoad() {
    this.connected = this.serverProvider.isConnected();
    this.settings.getOfflineModeEnabled().then(offlineMode => {
      if (offlineMode) this.connected = false;
    })

    this.onDisconnectSubscription = this.serverProvider.onDisconnect().subscribe(() => {
      this.connected = false;
    });
    this.onConnectSubscription = this.serverProvider.onConnect().subscribe(() => {
      this.connected = true;
    });

    if (this.isNewSession) { // se ho premuto + su scan-sessions allora posso già iniziare la scansione
      this.scan();
    } else {
      // It will be shown only once because ioViewDidLoad is always called only once
      BluebirdPromise.join(this.settings.getNoRunnings(), this.settings.getSoundFeedbackOrDialogShown(), this.settings.getEnableBeep(), async (runnings, soundFeedbackOrDialogShown, enableBeep) => {
        this.enableBeep = enableBeep;
        if (!soundFeedbackOrDialogShown && runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_SOUND_FEEDBACK_OR_DIALOG) {
          this.alertCtrl.create({
            title: await this.utils.text('beepSoundDialogTitle'),
            message: await this.utils.text('beepSoundDialogMessage'),
            buttons: [
              { text: await this.utils.text('beepSoundDialogOpenSettingsButton'), handler: () => { this.navCtrl.push(SettingsPage) } },
              { text: await this.utils.text('beepSoundDialogShowLaterButton'), role: 'cancel', handler: () => { } },
              {
                text: await this.utils.text('beepSoundDialogUnderstandButton'), role: 'cancel', handler: () => { this.settings.setSoundFeedbackOrDialogShown(true); }
              }]
          }).present();
        }
      });
    }

    this.events.subscribe('settings:save', async () => {
      this.realtimeSend = await this.settings.getRealtimeSendEnabled();
    });

    this.serverProvider.onConnect().subscribe(async () => {
      if (!this.catchUpIOSLag || !await this.settings.getRealtimeSendEnabled()) return;
      this.catchUpIOSLag = false;
      this.onRepeatAllClick(false);
    });
  }

  ionViewDidLeave() {
    // BWP::start
    this.menuCtrl.enable(true);
    this.webIntent.unregisterBroadcastReceiver();
    // BWP::end
    if (this.responseSubscription != null && this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }

    if (this.scanProviderSubscription && this.scanProviderSubscription != null) {
      this.scanProviderSubscription.unsubscribe();
    }

    if (this.unregisterBackButton != null) {
      this.unregisterBackButton();
      this.unregisterBackButton = null;
    }

    this.webIntent.unregisterBroadcastReceiver();
  }

  async ionViewWillEnter() {
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
    this.realtimeSend = await this.settings.getRealtimeSendEnabled();
    this.disableKeyboarAutofocus = await this.settings.getDisableKeyboarAutofocus();


    // BWP::start
    // Use to detect wether the webview is visible or if the scanner plugin is
    // covering it instead.
    if (this.resumeSubscription != null) {
      this.resumeSubscription.unsubscribe();
      this.resumeSubscription = null;

      this.pauseSubscription.unsubscribe();
      this.pauseSubscription = null;
    }
    this.resumeSubscription = this.platform.resume.subscribe(async () => {
      let defaultName = await this.settings.getScanSessionName();
      defaultName = await this.utils.supplant(defaultName, {
        scan_session_number: await this.scanSessionsStorage.getNextScanSessionNumber(),
        device_name: await this.settings.getDeviceName(),
        date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        custom: moment().format('YYYY-MM-DD') // duplicated code on the scan-session.ts file to check if a day has passed
      });
      console.log('@@@@ resume', this.scanSession.name, defaultName)
      if (this.scanSession && this.scanSession.name != defaultName) {
        const alert = this.alertCtrl.create({
          title: 'Good morning!',
          message: 'It\'s a new day. Tap Next to start a new scan session.',
          buttons: [
            {
              text: 'Next',
              handler: () => {
                const loader = this.loadingCtrl.create({
                  content: "Please wait...",
                  dismissOnPageChange: true,
                  enableBackdropDismiss: false,
                  showBackdrop: true,
                });
                loader.present();
                window.location.reload();
              }
            }
          ]
        });
        alert.present();
      }
      setTimeout(() => { this.isPaused = false; }, 2000);
    });
    this.pauseSubscription = this.platform.pause.subscribe(() => { this.isPaused = true; });
    this.pauseSubscription = this.platform.pause.subscribe(() => {
      this.isPaused = true;
      // Pause all toast and dialogs until next resume is called
      if (this.platform.is('ios')) {
        this.catchUpIOSLag = true;
      }
    });
    // BWP::end
  }

  async ionViewWillLeave() {
    if (this.resumeSubscription != null) {
      this.resumeSubscription.unsubscribe();
      this.resumeSubscription = null;

      this.pauseSubscription.unsubscribe();
      this.pauseSubscription = null;
    }
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
  keyboardInputTouchStart(event, focus = true) {
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
        if (this.scanProvider.awaitingForBarcode && focus) {
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
    // Add the 'flash-first-item' class to the first item
    this.newItem = true;
    setTimeout(() => {
      this.newItem = false; // Remove the flag after the animation
    }, 1000); // Adjust time to match your animation
    if (this.realtimeSend) this.sendPutScan(scan);
  }

  private showImage(scan) {
    const imageBlock = scan.outputBlocks.find(x => x.type == 'image');
    if (this.platform.is('ios')) {
      this.iab.create(imageBlock.image, '_blank', 'enableViewportScale=yes,location=no,closebuttoncaption=Close,closebuttoncolor=#ffffff');
    } else {
      const options = {
        share: true, // default is false
        closeButton: true, // default is true
        copyToReference: false, // default is false
        headers: '',  // If this is not provided, an exception will be triggered
        piccasoOptions: {} // If this is not provided, an exception will be triggered
      };
      this.photoViewer.show(imageBlock.image, scan.displayValue, options);
    }
  }

  async onItemClicked(scan: ScanModel, scanIndex: number) {
    if (!this.serverProvider.isConnected()) {
      this.showImage(scan);
      return;
    }

    if (scan.ack == true) {
      const buttons = [];
      buttons.push({
        text: await this.utils.text('alreadyReceivedScanCancelButton'), role: 'cancel', handler: () => { },
        cssClass: this.platform.is('android') ? 'button-outline-md ' + (scan.hasImage ? 'button-generic' : '') : null,
      });
      if (scan.hasImage) {
        buttons.push({
          text: await this.utils.text('alreadyReceivedScanDialogViewImageButton'), handler: () => {
            this.showImage(scan);
          },
          cssClass: this.platform.is('android') ? 'button-outline-md button-generic' : null,
        });
      }
      buttons.push({
        text: await this.utils.text('alreadyReceivedScanDialogSendAgainButton'), handler: () => { this.repeat(scan); },
        cssClass: this.platform.is('android') ? 'button-outline-md button-ok' : null,
      });
      this.alertCtrl.create({
        title: await this.utils.text('alreadyReceivedScanDialogTitle'),
        message: await this.utils.text('alreadyReceivedScanDialogMessage'),
        // cssClass: this.platform.is('android') ? 'alert-get-field alert-big-buttons' : null,
        buttons: buttons,
      }).present();
    } else {
      this.repeatingStatus = 'repeating';
      this.repeat(scan);
      this.repeatingStatus = 'stopped';
    }
    this.firebaseAnalytics.logEvent('repeat', {});
  }

  async onItemPressed(scan: ScanModel, scanIndex: number) {
    let buttons = [];

    buttons.push({
      text: await this.utils.text('scanDeleteOnlySmartphoneDeleteButton'), icon: 'trash', role: 'destructive', handler: async () => {
        this.firebaseAnalytics.logEvent('delete', {});
        this.alertCtrl.create({
          title: await this.utils.text('scanDeleteOnlySmartphoneDialogTitle'),
          message: await this.utils.text('scanDeleteOnlySmartphoneDialogMessage'),
          buttons: [{
            text: await this.utils.text('scanDeleteOnlySmartphoneDialogCancelButton'), role: 'cancel'
          }, {
            text: await this.utils.text('scanDeleteOnlySmartphoneDialogDeleteButton'), handler: () => {
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
      text: await this.utils.text('shareButton'), icon: 'share', handler: () => {
        this.firebaseAnalytics.logEvent('share', {});
        this.socialSharing.share(scanString, "", "", "")
      }
    });

    if (scanString.toLocaleLowerCase().trim().startsWith('http')) {
      buttons.push({
        text: await this.utils.text('openInBrowserButton'), icon: 'open', handler: () => {
          this.firebaseAnalytics.logEvent('open_browser', {});
          this.iab.create(scanString, '_system');
        }
      });
    }

    buttons.push({
      text: await this.utils.text('repeatHereButton'), icon: 'refresh',
      handler: () => {
        this.firebaseAnalytics.logEvent('repeatAll', {});
        if (this.repeatingStatus == 'stopped') {
          this.repeatAll(scanIndex);
        }
      }
    });

    buttons.push({ text: await this.utils.text('cancelButton'), role: 'cancel' });

    let actionSheet = this.actionSheetCtrl.create({ buttons: buttons });
    actionSheet.present();
  } // onItemClick

  async onEditClick() {
    if (!this.serverProvider.isConnected()) {
      this.alertCtrl.create({
        title: await this.utils.text('actionOnlyOnlineDialogTitle'),
        message: await this.utils.text('actionOnlyOnlineDialogMessage'),
        buttons: [{
          text: await this.utils.text('actionOnlyOnlineDialogCloseButton'),
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

  async sendPutScan(scan: ScanModel, sendKeystrokes = true) {
    let scanSession = { ...this.scanSession }; // do a shallow copy (copy only the properties of the object first level)
    scanSession.scannings = [scan];

    if (this.repeatingStatus === 'repeating') {
      // Remote components OOB Execution
      for (let i = 0; i < scan.outputBlocks.length; i++) {
        const block = scan.outputBlocks[i];
        if (block.allowOOBExecution) {
          const newOutputBlock = await this.scanProvider.remoteComponent(block);
          Object.assign(scan.outputBlocks[i], newOutputBlock);
          scan.displayValue = ScanModel.ToString(scan);
          this.save();
        }
      }
    }

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
    if (setRepeated) {
      scan.repeated = true;
    }
    this.sendPutScan(scan);
    if (this.enableBeep) {
      this.nativeAudio.play('beep');
    }
  }

  async onRepeatAllClick(showConfirmDialog = true) {
    const doRepeat = () => {
      if (!this.scanSession) return;
      this.settings.getRepeatInterval().then(repeatInterval => {
        if (repeatInterval != null) {
          this.repeatInterval = repeatInterval;
        }
        if (this.repeatingStatus != 'repeating' && this.repeatingStatus != 'paused') {
          let startFrom = this.scanSession.scannings.length - 1;
          this.repeatAll(startFrom);
        }
      })
    };

    if (showConfirmDialog) {
      // BWP::start
      this.skipAlreadySent = true;
      doRepeat();
      // BWP::end
    }
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
    if (this.repeatingStatus == 'repeating') return;
    this.keyboardInput.submit();
  }

  private repeatAll(startFrom = -1) {
    if (startFrom < 0 || startFrom >= this.scanSession.scannings.length) {
      this.stopRepeatingClick();
      return;
    }

    this.repeatingStatus = 'repeating';
    let scan = this.scanSession.scannings[startFrom];

    let waitTime = this.repeatInterval;
    if (this.skipAlreadySent && scan.ack) {
      // if the scan is already sent, we skip waiting and repeat the next item
      waitTime = 0;
    } else {
      this.repeat(scan);
    }

    this.next = startFrom - 1;

    if (this.repeatAllTimeout) clearTimeout(this.repeatAllTimeout)

    this.repeatAllTimeout = setTimeout(() => {
      if (this.next >= 0) {
        this.repeatAll(this.next);
      } else {
        this.stopRepeatingClick();
      }
    }, waitTime);
  }

  onShareClick() {
    let editModal = this.modalCtrl.create(CSVExportOptionsPage, this.scanSession);
    editModal.onDidDismiss(csv => {

      // Convert the csv string to base64 encoded data
      let base64CSV = null;
      try {
        base64CSV = btoa(csv);
        if (!base64CSV) { this.onShareClickFallBack(csv); return; }
      } catch (error) {
        this.onShareClickFallBack(csv);
      }

      // Share using base64 method
      if (this.utils.isAndroid()) {
        this.socialSharing.share(null, this.scanSession.name, "data:text/csv;base64," + base64CSV, null)
      } else {
        // iOS Quirk: https://github.com/EddyVerbruggen/SocialSharing-PhoneGap-Plugin/issues/778
        this.socialSharing.share(null, this.scanSession.name, "data:text/csv;df:" + this.scanSession.name + ".csv;base64," + base64CSV, null)
      }
    });
    editModal.present();
  }

  async onShareClickFallBack(csv: string) {
    // Remove previous files
    const fileName = this.scanSession.name + '.csv';
    try {
      await this.file.removeFile(this.file.cacheDirectory, fileName)
    } catch { }

    // Save to file system
    let result = await this.file.writeFile(this.file.cacheDirectory, fileName, csv);
    if (result && result.nativeURL) {

      // Share the file
      this.socialSharing.share(null, this.scanSession.name, result.nativeURL, null);
    } else {
      // Should happen only if the cache dir si not writable or the disk is full.
      this.alertCtrl.create({
        title: await this.utils.text('exportErrorDialogButton'),
        message: await this.utils.text('exportErrorDialogMessage', { "config.email_support": Config.EMAIL_SUPPORT })
      }).present();
    }
  }

  getTitle() {
    if (this.repeatingStatus == 'repeating' || this.catchUpIOSLag) return 'Syncing...'
    return this.scanSession && this.scanSession.name;
  }

  async onNFCClick() {
    // iOS Only

    // Ask to enable the settings
    const enabled = await this.settings.getEnableNFC();
    if (!enabled) {
      this.alertCtrl.create({
        title: await this.utils.text('nfcDisabledDialogTitle'),
        message: await this.utils.text('nfcDisabledDialogMessage'),
        buttons: [
          { text: await this.utils.text('nfcDisabledDialogCancel'), role: 'cancel', handler: () => { } },
          {
            text: await this.utils.text('nfcDisabledDialogEnable'), handler: () => {
              const trickFn = async () => {
                this.settings.setEnableNFC(true);
                this.alertCtrl.create({
                  title: await this.utils.text('nfcDisabledSuccessDialogTitle'),
                  message: await this.utils.text('nfcDisabledSuccessDialogMessage'),
                  buttons: [
                    {
                      text: await this.utils.text('nfcDisabledSuccessDialogClose'), handler: () => {
                        this.settings.setEnableNFC(true);
                      }
                    },
                  ]
                }).present();
              };
              trickFn();
            }
          },
        ]
      }).present();
      return;
    } else {
      if (this.platform.is('android')) {
        // Android can scan continuosly, alert the user that there is no need to press the button
        this.alertCtrl.create({
          title: await this.utils.text('nfcAndroidInstructionTitle'),
          message: await this.utils.text('nfcAndroidInstructionMessage'),
          buttons: [{ text: await this.utils.text('nfcDisabledSuccessDialogClose'), handler: () => { } },]
        }).present();
      } else if (this.platform.is('ios')) {
        // Start the session (system overlay)
        this.nfc.beginSession(
          success => { },
          err => { console.log('NFC session err', err) }
        ).subscribe((session) => { });
      }
    }
  }

  // BWP::start
  getDisplayValue(scan: ScanModel) {
    const barcode = scan.outputBlocks.find(x => x.type == 'barcode').value;
    const date = scan.outputBlocks.find(x => x.type == 'date_time').value;
    // <b>ITF:</b> ${barcode.replace(/\x1d/g, '').substr(2, 14)}<br>
    return `
    <table>
      <tr>
        <td><b>Date:</b></td>
        <td class="value">${date}</td>
      </tr>
      <tr>
        <td><b>Label S/N:</b></td>
        <td class="value">${barcode.replace(/\x1d/g, '').substr(18, 7)}</td>
      </tr>
      <tr>
        <td><b>Tag Colour:</b></td>
        <td class="value">${barcode.replace(/\x1d/g, '').substr(27, 5)}</td>
      </tr>
      <tr>
        <td><b>Item Code:</b></td>
        <td class="value">${barcode.replace(/\x1d/g, '').substr(35, 9999)}</td>
      </tr>
    </table>`;
  }
  // BWP::end
}
