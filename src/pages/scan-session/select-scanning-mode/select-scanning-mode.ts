import { Component, ViewChild } from '@angular/core';
import { BarcodeScanner, BarcodeScanResult } from '@fttx/barcode-scanner';
import { TranslateService } from '@ngx-translate/core';
import { AlertButton, AlertController, Content, NavParams, Platform, ViewController } from 'ionic-angular';
import { OutputProfileModel } from '../../../models/output-profile.model';
import { ScanSessionModel } from '../../../models/scan-session.model';
import { ScanSessionsStorage } from '../../../providers/scan-sessions-storage';
import { Utils } from '../../../providers/utils';
import { Settings } from './../../../providers/settings';
import { BtpAlertController } from '../../../providers/btp-alert-controller/btp-alert-controller';


@Component({
  selector: 'page-select-scanning-mode',
  templateUrl: 'select-scanning-mode.html'
})
export class SelectScanningModePage {
  public static IsVisible = false;
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
    public alertCtrl: BtpAlertController,
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
    let allOutputProfiles = await this.settings.getOutputProfiles();

    // Filter by allowedOnDeviceNames
    const deviceName = await this.settings.getDeviceName();
    const filteredProfiles = allOutputProfiles.filter(profile => {
      // If allowedOnDeviceNames is not set or empty, allow this profile
      if (!profile.allowedOnDeviceNames || profile.allowedOnDeviceNames.trim().length === 0) {
        return true;
      }
      // Parse the CSV string and check if current device name matches any pattern
      const allowedNames = profile.allowedOnDeviceNames.split(',').map(name => name.trim());
      return allowedNames.some(pattern => {
        if (pattern.indexOf('%') !== -1) {
          // Handle wildcard pattern (% is wildcard)
          const regexPattern = pattern.replace(/%/g, '.*');
          const regex = new RegExp('^' + regexPattern + '$', 'i');
          return regex.test(deviceName);
        } else {
          // Exact match (case insensitive)
          return pattern.toLowerCase() === deviceName.toLowerCase();
        }
      });
    });

    // If no profiles match the filter, fall back to default profile
    if (filteredProfiles.length > 0) {
      this.outputProfiles = filteredProfiles;
    } else {
      // Generate and use only the default profile
      this.outputProfiles = await this.settings.generateDefaultOutputProfiles();
    }

    // Get the previously selected profile index from the FULL list
    const savedIndexInFullList = await this.settings.getSelectedOutputProfile();

    // Find the actual profile from the full list using the saved index
    let previouslySelectedProfile = null;
    if (savedIndexInFullList >= 0 && savedIndexInFullList < allOutputProfiles.length) {
      previouslySelectedProfile = allOutputProfiles[savedIndexInFullList];
    }

    // Find the index of this profile in the filtered list
    if (previouslySelectedProfile) {
      this.selectedOutputProfileIndex = this.outputProfiles.findIndex(p => p.name === previouslySelectedProfile.name);
      // If the previously selected profile is not in the filtered list, default to first
      if (this.selectedOutputProfileIndex === -1) {
        this.selectedOutputProfileIndex = 0;
      }
    } else {
      this.selectedOutputProfileIndex = 0;
    }

    // Prevent OutOfBounds (safety check)
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
      // Find the index in the full list to return
      const indexInFullList = allOutputProfiles.findIndex(p => p.name === this.selectedOutputProfile.name);

      this.viewCtrl.dismiss({
        scanMode: this.defaultMode,
        selectedOutputProfileIndex: indexInFullList !== -1 ? indexInFullList : savedIndexInFullList,
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

    let selectedOutputProfileIndexInFilteredList = this.outputProfiles.indexOf(this.selectedOutputProfile);

    // Find the index in the FULL list of profiles
    // This is critical because ScanProvider expects an index from the full list
    const allOutputProfiles = await this.settings.getOutputProfiles();
    const indexInFullList = allOutputProfiles.findIndex(p => p.name === this.selectedOutputProfile.name);

    // If the user checked the option to save the mode
    if (this.setAsDefaultMode) {
      this.settings.setDefaultMode(scanMode);
    }

    // Save the index in the full list
    if (indexInFullList !== -1) {
      this.settings.setSelectedOutputProfile(indexInFullList);
    } else {
      // Fallback: if not found in full list (shouldn't happen), use the filtered index
      this.settings.setSelectedOutputProfile(selectedOutputProfileIndexInFilteredList);
    }

    // Return the index in the FULL list, not the filtered list
    // because ScanProvider.scan() expects an index from the full list
    this.viewCtrl.dismiss({
      scanMode: scanMode,
      selectedOutputProfileIndex: indexInFullList !== -1 ? indexInFullList : selectedOutputProfileIndexInFilteredList,
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
          date: new Date().toISOString().slice(0, 10).replace(/-/g, "")
        });

        let alwaysUseCameraForScanSessionName = await this.settings.getAlwaysUseCameraForScanSessionName();
        let buttons: any = [];

        // By hand
        buttons.push({
          text: await this.utils.text('getScanSessionNameDialogOkButton'), handler: data => {
            if (data.name != "") {
              resolve(data.name)
            } else {
              resolve(defaultName)
            }
          },
        });

        // Camera
        if (alwaysUseCameraForScanSessionName) {
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
            },
            role: 'cancel',
          });
        }

        // Cancel
        buttons.push({ text: await this.utils.text('getScanSessionNameDialogCancelButton'), handler: () => { reject() }, role: 'cancel' });

        // If the barcode acquisition failed, or wasn't never requested
        // (see the `return` statement above)
        let alert = this.alertCtrl.create({
          title: await this.utils.text('scanSessionDialogTitle'),
          message: this.filterErrorMessage,
          inputs: [{ name: 'name', placeholder: defaultName }],
          buttons: buttons,
          enableBackdropDismiss: false,
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

  ionViewDidEnter() {
    SelectScanningModePage.IsVisible = true;
  }
  ionViewDidLeave() {
    SelectScanningModePage.IsVisible = false;
  }
}
