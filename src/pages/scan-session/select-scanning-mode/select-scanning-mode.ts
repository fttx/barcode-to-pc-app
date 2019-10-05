import { Component, ViewChild } from '@angular/core';
import { Content, ViewController } from 'ionic-angular';
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

  @ViewChild(Content) content: Content;
  constructor(
    public viewCtrl: ViewController,
    private settings: Settings,
    // public ngZone: NgZone,
  ) { }

  ionViewWillEnter() {
    this.settings.getDefaultMode().then(savedScanMode => {
      if (savedScanMode && savedScanMode.length > 0) {
        this.viewCtrl.dismiss(savedScanMode);
      }
    })

    this.settings.getOutputProfiles().then((outputProfiles: OutputProfileModel[]) => {
      this.outputProfiles = outputProfiles;
      // this.outputProfiles = [{ name: 'Profile 1', outputBlocks: [] }, { name: 'Profile 2', outputBlocks: [] }, { name: 'Profile 3', outputBlocks: [] },]
      this.content.resize(); // refresh the ion-content height, since the ion-footer has been hidden/shown
    })
  }

  dismiss(scanMode) {
    if (this.isDefault) {
      this.settings.setDefaultMode(scanMode);
    }
    this.viewCtrl.dismiss(scanMode);
  }
}
