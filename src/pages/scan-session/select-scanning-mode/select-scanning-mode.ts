import { Component, ViewChild } from '@angular/core';
import { AlertController, Content, NavParams, ViewController } from 'ionic-angular';
import * as Supplant from 'supplant';
import { OutputProfileModel } from '../../../models/output-profile.model';
import { Settings } from './../../../providers/settings';
import { ScanSessionModel } from '../../../models/scan-session.model';
import { ScanSessionsStorage } from '../../../providers/scan-sessions-storage';


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
  public scanSession: ScanSessionModel;

  @ViewChild(Content) content: Content;
  constructor(
    public viewCtrl: ViewController,
    public alertCtrl: AlertController,
    private settings: Settings,
    private scanSessionsStorage: ScanSessionsStorage,
    public navParams: NavParams,
    // public ngZone: NgZone,
  ) {
    this.scanSession = navParams.get('scanSession');
  }

  async ionViewWillEnter() {
    // Get the output profile
    this.outputProfiles = await this.settings.getOutputProfiles();
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
    if (this.selectedOutputProfileIndex >= this.outputProfiles.length) {
      // Prevent OutOfBounds.
      // The same logic is duplciated in the ScanProvider/getOutputProfile() method
      this.selectedOutputProfileIndex = this.outputProfiles.length - 1;
    }
    this.selectedOutputProfile = this.outputProfiles[this.selectedOutputProfileIndex];

    // If there is a default scan mode  => Dismiss immediately
    let defaultMode = await this.settings.getDefaultMode();
    if (defaultMode && defaultMode.length > 0) {
      this.viewCtrl.dismiss({
        scanMode: defaultMode,
        selectedOutputProfileIndex: this.selectedOutputProfileIndex,
        scanSession: this.scanSession
      });
    }

    // Refresh the ion-content height, since the ion-footer has been hidden/shown
    // this.outputProfiles = [{ name: 'Profile 1', outputBlocks: [] }, { name: 'Profile 2', outputBlocks: [] }, { name: 'Profile 3', outputBlocks: [] },]
    this.content.resize();
  }

  // Called when a mode button is tapped
  async dismiss(scanMode) {
    // If the user checked the option to save the mode
    if (this.setAsDefaultMode) {
      this.settings.setDefaultMode(scanMode);
    }

    let selectedOutputProfileIndex = this.outputProfiles.indexOf(this.selectedOutputProfile);
    this.settings.setSelectedOutputProfile(selectedOutputProfileIndex);

    // Create the scanSession if not exists
    if (!this.scanSession) {
      let date: number = new Date().getTime();

      let scanSessionName;
      try {
        scanSessionName = await this.getScanSessionName();
      } catch (e) { // onCancel
        return;
      }

      let newScanSession: ScanSessionModel = {
        id: date,
        name: scanSessionName,
        date: date,
        scannings: [],
        selected: false,
      };
      this.scanSession = newScanSession;
    }

    // Return the data to the caller view
    this.viewCtrl.dismiss({
      scanMode: scanMode,
      selectedOutputProfileIndex: selectedOutputProfileIndex,
      scanSession: this.scanSession
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

      let alert = this.alertCtrl.create({
        title: 'Name', message: 'Insert a name for this scan session',
        inputs: [{ name: 'name', placeholder: defaultName }],
        buttons: [
          { text: 'Cancel', handler: () => { reject() } },
          { text: 'Ok', handler: data => { } }
        ],
        enableBackdropDismiss: false,
      });

      alert.onDidDismiss((data) => {
        if (data.name != "") {
          resolve(data.name)
        } else {
          resolve(defaultName)
        }
      })

      alert.present();
    });
  }
}
