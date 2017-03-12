import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';

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

  constructor(
    public viewCtrl: ViewController,
  ) {
  }

  ionViewDidLoad() { }

  dismiss(scanMode) {
    this.viewCtrl.dismiss(scanMode);
  }
}
