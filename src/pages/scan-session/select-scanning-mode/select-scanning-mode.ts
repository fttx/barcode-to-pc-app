import { Component, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScanResult } from '@fttx/barcode-scanner';
import { AlertButton, AlertController, Content, NavParams, Platform, ViewController } from 'ionic-angular';
import * as Supplant from 'supplant';
import { OutputProfileModel } from '../../../models/output-profile.model';
import { ScanSessionModel } from '../../../models/scan-session.model';
import { ScanSessionsStorage } from '../../../providers/scan-sessions-storage';
import { Settings } from './../../../providers/settings';


@Component({
  selector: 'page-select-scanning-mode',
  templateUrl: 'select-scanning-mode.html'
})
export class SelectScanningModePage {
  public static SCAN_MODE_ASK = '';
  public static SCAN_MODE_CONTINUE = 'continue';
  public static SCAN_MODE_SINGLE = 'single';
  public static SCAN_MODE_ENTER_MAUALLY = 'keyboard';

  public setAsDefaultMode = false;
  public outputProfiles: OutputProfileModel[] = [];
  public selectedOutputProfile: OutputProfileModel; // use for ngModel
  public selectedOutputProfileIndex = 0; // used for set [checked] the radios
  public scanSession: ScanSessionModel; // stores the scanSession passed by the parent view

  @ViewChild(Content) content: Content;
  constructor(
    public viewCtrl: ViewController,
    public alertCtrl: AlertController,
    private settings: Settings,
    private scanSessionsStorage: ScanSessionsStorage,
    public navParams: NavParams,
    private platform: Platform,
    private barcodeScanner: BarcodeScanner,
    // public ngZone: NgZone,
  ) {
    this.scanSession = navParams.get('scanSession');
  }

  async ionViewWillEnter() {
    // Get the output profile
    this.outputProfiles = await this.settings.getOutputProfiles();
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
    // Prevent OutOfBounds.
    // The same logic is duplciated in the ScanProvider/getOutputProfile() method
    if (this.selectedOutputProfileIndex >= this.outputProfiles.length) {
      this.selectedOutputProfileIndex = this.outputProfiles.length - 1;
    }
    if (this.selectedOutputProfileIndex < 0) {
      this.selectedOutputProfileIndex = 0;
    }
    this.selectedOutputProfile = this.outputProfiles[this.selectedOutputProfileIndex];

    // If there is a default scan mode  => Dismiss immediately
    let defaultMode = await this.settings.getDefaultMode();
    if (defaultMode && defaultMode.length > 0) {
      this.viewCtrl.dismiss({
        scanMode: defaultMode,
        selectedOutputProfileIndex: this.selectedOutputProfileIndex,
        scanSession: await this.getScanSession()
      });
    }

    // Refresh the ion-content height, since the ion-footer has been hidden/shown
    // this.outputProfiles = [{ name: 'Profile 1', outputBlocks: [] }, { name: 'Profile 2', outputBlocks: [] }, { name: 'Profile 3', outputBlocks: [] },]
    this.content.resize();
  }

  // Called when a mode button is tapped
  async dismiss(scanMode) {
    if (!scanMode) {
      this.viewCtrl.dismiss({ cancelled: true });
      return;
    }

    // If the user checked the option to save the mode
    if (this.setAsDefaultMode) {
      this.settings.setDefaultMode(scanMode);
    }

    let selectedOutputProfileIndex = this.outputProfiles.indexOf(this.selectedOutputProfile);
    this.settings.setSelectedOutputProfile(selectedOutputProfileIndex);

    // Return the data to the caller view
    this.viewCtrl.dismiss({
      scanMode: scanMode,
      selectedOutputProfileIndex: selectedOutputProfileIndex,
      scanSession: await this.getScanSession()
    });
  }

  getBarcodetScanSessionName(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      this.barcodeScanner.scan({ "showFlipCameraButton": true }).subscribe(async (scan: BarcodeScanResult) => {
        if (scan && scan.text) {
          resolve(scan.text);
        } else {
          reject()
        }
      }, async err => { reject() });
    });
  }

  getScanSessionName(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let defaultName = await this.settings.getScanSessionName();
      defaultName = new Supplant().text(defaultName, {
        scan_session_number: await this.scanSessionsStorage.getNextScanSessionNumber(),
        device_name: await this.settings.getDeviceName(),
        date: new Date().toISOString().slice(0, 10).replace(/-/g, "")
      });

      let alwaysUseDefaultScanSessionName = await this.settings.getAlwaysUseDefaultScanSessionName();

      if (alwaysUseDefaultScanSessionName) {
        resolve(defaultName);
      } else {
        let alwaysUseCameraForScanSessionName = await this.settings.getAlwaysUseCameraForScanSessionName();
        let buttonClasses = alwaysUseCameraForScanSessionName ? ' alert-button-stacked' : '';
        let buttons: any = [{ text: 'Cancel', handler: () => { reject() }, cssClass: this.platform.is('android') ? 'button-outline-md' + buttonClasses : null }];

        if (alwaysUseCameraForScanSessionName) {
          buttonClasses += " alert-button-stacked";
          try {
            // Try to get the a barcode value
            let scanSessionName = await this.getBarcodetScanSessionName();
            resolve(scanSessionName);
            return;
          } catch { }

          buttons.push({
            text: 'Acquire Barcode', handler: async data => {
              resolve(await this.getScanSessionName());
            }, cssClass: this.platform.is('android') ? 'button-outline-md' + buttonClasses : null,
          });
        }

        buttons.push({
          text: 'Ok', handler: data => {
            if (data.name != "") {
              resolve(data.name)
            } else {
              resolve(defaultName)
            }
          }, cssClass: this.platform.is('android') ? 'button-outline-md button-ok' + buttonClasses : null,
        });

        // If the barcode acquisition failed, or wasn't never requested:
        let alert = this.alertCtrl.create({
          title: 'Scan session name',
          inputs: [{ name: 'name', placeholder: defaultName }],
          buttons: buttons,
          enableBackdropDismiss: false,
          cssClass: this.platform.is('android') ? 'alert-big-buttons' : null,
        });
        alert.present();
      }
    });
  }

  /**
   * Creates the scanSession if not exists
   */
  getScanSession() {
    return new Promise(async (resolve, reject) => {
      if (!this.scanSession) {
        let date: number = new Date().getTime();

        let scanSessionName;
        try {
          scanSessionName = await this.getScanSessionName();
        } catch (e) { // onCancel
          reject();
          return;
        }

        let newScanSession: ScanSessionModel = {
          id: date,
          name: scanSessionName,
          date: date,
          scannings: [],
          selected: false,
        };
        resolve(newScanSession)
      } else {
        resolve(this.scanSession);
      }
    });
  }
}
