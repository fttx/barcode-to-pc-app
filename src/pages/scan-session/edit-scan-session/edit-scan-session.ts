import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';
import { ScanSessionModel } from '../../../models/scan-session.model'

/*
  Generated class for the EditScanSession page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-edit-scan-session',
  templateUrl: 'edit-scan-session.html'
})
export class EditScanSessionPage {
  public scanSession: ScanSessionModel;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController
  ) {
    this.scanSession = viewCtrl.getNavParams().data;
  }

  ionViewDidLoad() { }

  onDateChanged(date) {
    // TODO: ionic è ancora in beta!
  }

  dismiss() {
    this.viewCtrl.dismiss(this.scanSession);
  }

}
