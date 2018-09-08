import { Component } from '@angular/core';
import { ViewController, NavParams } from 'ionic-angular';
import { Settings } from './../../../providers/settings';
import { platformBrowser } from '@angular/platform-browser';

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
  public static SCAN_MODE_CONTINUE = 'continue';
  public static SCAN_MODE_SINGLE = 'single';
  public static SCAN_MODE_EMPTY = 'empty';

  public isDefault = false;

  public showCreateEmptyScanSession = false;

  constructor(
    public viewCtrl: ViewController,
    private settings: Settings,
    public navParams: NavParams,
  ) {
    this.showCreateEmptyScanSession = navParams.get('showCreateEmptyScanSession');
  }

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
}
