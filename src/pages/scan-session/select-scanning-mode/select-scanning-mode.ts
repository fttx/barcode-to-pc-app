import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';

import { Settings } from './../../../providers/settings';

/*
  Generated class for the SelectScanningModePage page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-select-scanning-mode',
  templateUrl: 'select-scanning-mode.html'
})
export class SelectScanningModePage {
  public static SCAN_MODE_ASK = '';
  public static SCAN_MODE_CONTINUE = 'continue';
  public static SCAN_MODE_SINGLE = 'single';
  public static SCAN_MODE_ENTER_MAUALLY = 'keyboard';

  public static GetScanModeList() {
    return [
      SelectScanningModePage.SCAN_MODE_ASK,
      SelectScanningModePage.SCAN_MODE_CONTINUE,
      SelectScanningModePage.SCAN_MODE_SINGLE,
      SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY,
    ]
  }

  public static GetScanModeName(scanMode: string) {
    switch (scanMode) {
      case SelectScanningModePage.SCAN_MODE_ASK: return 'Ask everytime'
      case SelectScanningModePage.SCAN_MODE_CONTINUE: return 'Continue mode'
      case SelectScanningModePage.SCAN_MODE_SINGLE: return 'Single mode'
      case SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY: return 'Enter manually'
      default: break;
    }
  }

  public isDefault = false;

  constructor(
    public viewCtrl: ViewController,
    private settings: Settings,
  ) { }

  ionViewWillEnter() {
    this.settings.getDefaultMode().then(savedScanMode => {
      if (savedScanMode && savedScanMode.length > 0) {
        this.viewCtrl.dismiss(savedScanMode);
      }
    })
  }

  dismiss(scanMode) {
    if (this.isDefault) {
      this.settings.setDefaultMode(scanMode);
    }
    this.viewCtrl.dismiss(scanMode);
  }

  public getScanModeName = SelectScanningModePage.GetScanModeName;
  public getScanModeList() {
    return SelectScanningModePage.GetScanModeList().filter(x => x != SelectScanningModePage.SCAN_MODE_ASK);
  }
}
