import { Component, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScanResult } from '@fttx/barcode-scanner';
import { TranslateService } from '@ngx-translate/core';
import { AlertButton, AlertController, Content, NavParams, Platform, ViewController } from 'ionic-angular';
import { OutputProfileModel } from '../../../models/output-profile.model';
import { ScanSessionModel } from '../../../models/scan-session.model';
import { ScanSessionsStorage } from '../../../providers/scan-sessions-storage';
import { Utils } from '../../../providers/utils';
import { Settings } from './../../../providers/settings';
import moment from 'moment';


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
  public defaultMode: string;
  public allowOutputTemplateSelection: boolean = true;

  private filterErrorMessage: string = null;

  @ViewChild(Content) content: Content;
  constructor(
    public viewCtrl: ViewController,
    public alertCtrl: AlertController,
    private settings: Settings,
    private scanSessionsStorage: ScanSessionsStorage,
    public navParams: NavParams,
    private platform: Platform,
    private barcodeScanner: BarcodeScanner,
    private utils: Utils,
    private translateService: TranslateService,
    // public ngZone: NgZone,
  ) {
    this.scanSession = navParams.get('scanSession');
  }

  async ionViewWillEnter() {
    // Get the output profile
    this.outputProfiles = await this.settings.getOutputProfiles();
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
    // Prevent OutOfBounds.
    // The same logic is duplicated in the ScanProvider/getOutputProfile() method
    if (this.selectedOutputProfileIndex >= this.outputProfiles.length) {
      this.selectedOutputProfileIndex = this.outputProfiles.length - 1;
    }
    if (this.selectedOutputProfileIndex < 0) {
      this.selectedOutputProfileIndex = 0;
    }
    this.selectedOutputProfile = this.outputProfiles[this.selectedOutputProfileIndex];

    // If there is a default scan mode  => Dismiss immediately
    this.allowOutputTemplateSelection = await this.settings.getAllowOutputTemplateSelection();
    this.defaultMode = await this.settings.getDefaultMode();
    if (this.isDefaultModeSet() && (!this.allowOutputTemplateSelection || this.outputProfiles.length == 1)) {
      this.viewCtrl.dismiss({
        scanMode: this.defaultMode,
        selectedOutputProfileIndex: this.selectedOutputProfileIndex,
        scanSession: await this.getScanSession()
      });
    }

    // Refresh the ion-content height, since the ion-footer has been hidden/shown
    // this.outputProfiles = [{ name: 'Profile 1', outputBlocks: [] }, { name: 'Profile 2', outputBlocks: [] }, { name: 'Profile 3', outputBlocks: [] },]
    this.content.resize();
  }

  public async onOutputProfileClick(outputProfile: OutputProfileModel, index: number) {
    if (this.isDefaultModeSet()) {
      this.onModeClick(this.defaultMode);
    }
  }

  public isDefaultModeSet(): boolean {
    if (!this.defaultMode) return false;
    if (this.defaultMode.length == 0) return false;
    return true;
  }

  // Called when a mode button is tapped, or the cancel button is tapped
  // Or internally by this class
  async onModeClick(scanMode) {
    // Cancel button
    if (!scanMode) {
      this.viewCtrl.dismiss({ cancelled: true });
      return;
    }

    let selectedOutputProfileIndex = this.outputProfiles.indexOf(this.selectedOutputProfile);
    // If the user checked the option to save the mode
    if (this.setAsDefaultMode) {
      this.settings.setDefaultMode(scanMode);
    }
    this.settings.setSelectedOutputProfile(selectedOutputProfileIndex);

    // Return the data to the caller view
    this.viewCtrl.dismiss({
      scanMode: scanMode,
      selectedOutputProfileIndex: selectedOutputProfileIndex,
      scanSession: await this.getScanSession()
    });
  }

  getBarcodeScanSessionName(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      this.barcodeScanner.scan({ "showFlipCameraButton": true, prompt: this.filterErrorMessage }).subscribe(async (scan: BarcodeScanResult) => {
        if (scan && scan.text) {
          resolve(scan.text);
        } else {
          reject()
        }
      }, async err => { reject() });
    });
  }

  async getScanSessionName(): Promise<string> {
    const filterStr = await this.settings.getScanSessionFilter();

    const acquireScanSessionName = (): Promise<string> => {
      return new Promise(async (resolve, reject) => {
        let defaultName = await this.settings.getScanSessionName();
        defaultName = await this.utils.supplant(defaultName, {
          scan_session_number: await this.scanSessionsStorage.getNextScanSessionNumber(),
          device_name: await this.settings.getDeviceName(),
          date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
          custom: moment().format('YYYY-MM-DD') // duplicated code on the scan-session.ts file to check if a day has passed
        });

        let alwaysUseCameraForScanSessionName = await this.settings.getAlwaysUseCameraForScanSessionName();
        let buttonClasses = alwaysUseCameraForScanSessionName ? ' alert-button-stacked' : '';
        let buttons: any = [{ text: await this.utils.text('getScanSessionNameDialogCancelButton'), handler: () => { reject() }, cssClass: this.platform.is('android') ? 'button-outline-md' + buttonClasses : null }];

        // Camera
        if (alwaysUseCameraForScanSessionName) {
          buttonClasses += " alert-button-stacked";
          try {
            // Try to get the a barcode value
            let scanSessionName = await this.getBarcodeScanSessionName();
            resolve(scanSessionName);
            return; // <- Note this
          } catch { }

          // If the camera acquisition fails, allow to enter a name by hand
          buttons.push({
            text: await this.utils.text('acquireBarcodeButton'), handler: async data => {
              resolve(await this.getScanSessionName());
            }, cssClass: this.platform.is('android') ? 'button-outline-md' + buttonClasses : null,
          });
        }

        // By hand
        buttons.push({
          text: await this.utils.text('getScanSessionNameDialogOkButton'), handler: data => {
            if (data.name != "") {
              resolve(data.name)
            } else {
              resolve(defaultName)
            }
          }, cssClass: this.platform.is('android') ? 'button-outline-md button-ok' + buttonClasses : null,
        });
        // If the barcode acquisition failed, or wasn't never requested
        // (see the `return` statement above)
        let alert = this.alertCtrl.create({
          title: await this.utils.text('scanSessionDialogTitle'),
          message: this.filterErrorMessage,
          inputs: [{ name: 'name', placeholder: defaultName }],
          buttons: buttons,
          enableBackdropDismiss: false,
          cssClass: this.platform.is('android') ? 'alert-big-buttons' : null,
        });

        let alwaysUseDefaultScanSessionName = await this.settings.getAlwaysUseDefaultScanSessionName();
        if (alwaysUseDefaultScanSessionName) {
          resolve(defaultName);
        } else {
          alert.present();
        }
      });
    }

    const filter: Promise<string> = new Promise(async (resolve, reject) => {
      const filterRegex = new RegExp(filterStr);
      let name: string;
      // Keep getting a new name until the filter matches
      try {
        do {
          name = await acquireScanSessionName();
          this.filterErrorMessage = this.translateService.instant('scanSessionFilterError');
        } while (!name.match(filterRegex));
        resolve(name);
      } catch {
        reject();
      }
    });

    if (!filterStr && filterStr != '') {
      return acquireScanSessionName();
    }
    return filter;
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
          syncedWith: [],
        };
        resolve(newScanSession)
      } else {
        resolve(this.scanSession);
      }
    });
  }
}
