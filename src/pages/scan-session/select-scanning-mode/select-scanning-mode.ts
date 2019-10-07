import { Component, ViewChild } from '@angular/core';
import { Content, ViewController, AlertController, NavParams } from 'ionic-angular';
import { OutputProfileModel } from '../../../models/output-profile.model';
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

  public isDefault = false;
  public outputProfiles: OutputProfileModel[] = [];
  public selectedOutputProfile: OutputProfileModel; // use for ngModel
  public selectedOutputProfileIndex = 0; // used for set [checked] the radios
  public scanSessionName: string;

  @ViewChild(Content) content: Content;
  constructor(
    public viewCtrl: ViewController,
    public alertCtrl: AlertController,
    private settings: Settings,
    public navParams: NavParams,
    // public ngZone: NgZone,
  ) {
    this.scanSessionName = navParams.get('scanSessionName');
  }

  async ionViewWillEnter() {
    this.outputProfiles = await this.settings.getOutputProfiles();
    this.selectedOutputProfileIndex = await this.settings.getSelectedOutputProfile();
    this.selectedOutputProfile = this.outputProfiles[this.selectedOutputProfileIndex];

    console.log( this.selectedOutputProfileIndex, this.selectedOutputProfile)
    this.settings.getDefaultMode().then(savedScanMode => {
      if (savedScanMode && savedScanMode.length > 0) {
        this.viewCtrl.dismiss({
          scanMode: savedScanMode,
          selectedOutputProfileIndex: this.selectedOutputProfileIndex,
          scanSessionName: this.scanSessionName
        });
      }
    })

    // this.outputProfiles = [{ name: 'Profile 1', outputBlocks: [] }, { name: 'Profile 2', outputBlocks: [] }, { name: 'Profile 3', outputBlocks: [] },]
    this.content.resize(); // refresh the ion-content height, since the ion-footer has been hidden/shown
  }

  async dismiss(scanMode) {
    if (this.isDefault) {
      this.settings.setDefaultMode(scanMode);
    }
    let selectedOutputProfileIndex = this.outputProfiles.indexOf(this.selectedOutputProfile);
    this.settings.setSelectedOutputProfile(selectedOutputProfileIndex);
    this.viewCtrl.dismiss({
      scanMode: scanMode,
      selectedOutputProfileIndex: selectedOutputProfileIndex,
      scanSessionName: await this.getScanSessionName()
    });
  }

  getScanSessionName(): Promise<string> {
    return new Promise((resolve, reject) => {
      let alert = this.alertCtrl.create({
        title: 'Name', message: 'Insert a name for this scan session',
        inputs: [{ name: 'name', placeholder: this.scanSessionName }],
        buttons: [{ text: 'Ok', handler: data => { } }]
      });
      alert.onDidDismiss((data) => {
        if (data.name != "") {
          this.scanSessionName = data.name;
        }
        resolve(this.scanSessionName)
      })
      alert.present();
    });
  }

}
