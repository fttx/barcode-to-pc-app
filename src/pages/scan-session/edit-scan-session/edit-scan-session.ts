import { Component } from '@angular/core';
import { NavController, ViewController } from 'ionic-angular';
import { ScanSessionModel } from '../../../models/scan-session.model'
import { requestModelUpdateScanSession } from '../../../models/request.model';
import { ServerProvider } from '../../../providers/server';

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
  public date: string;
  private static timezoneOffset = new Date().getTimezoneOffset() * 60000;

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    private serverProvider: ServerProvider,
  ) {
    this.scanSession = viewCtrl.getNavParams().data;
    this.date = (new Date(this.scanSession.date - EditScanSessionPage.timezoneOffset)).toISOString().slice(0, -1);
  }

  ionViewDidLoad() { }

  dismiss() {
    this.scanSession.date = this.convertDatePickerToTimestamp();
    this.viewCtrl.dismiss(this.scanSession);
  }

  convertDatePickerToTimestamp() {
    let d = new Date(Date.parse(this.date)).getTime();
    return new Date(d + EditScanSessionPage.timezoneOffset).getTime();
  }
}
