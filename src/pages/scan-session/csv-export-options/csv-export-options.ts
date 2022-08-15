import { Component } from '@angular/core';
import { NavController, NavParams, ViewController } from 'ionic-angular';
import { ScanSessionModel } from '../../../models/scan-session.model';
import { ScanModel } from '../../../models/scan.model';
import { Utils } from '../../../providers/utils';
import { SocialSharing } from '@ionic-native/social-sharing';

@Component({
  selector: 'page-csv-export-options',
  templateUrl: 'csv-export-options.html',
})
export class CSVExportOptionsPage {
  public scanSession: ScanSessionModel;

  public exportOnlyText: boolean = true;
  public enableQuotes: boolean = false;
  public enableHeaders: boolean = false;
  public csvDelimiter: string = ",";
  public newLineCharacter: string = 'CRLF';

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public socialSharing: SocialSharing,
  ) {
    this.scanSession = viewCtrl.getNavParams().data;
  }

  onExportClick() {
    let csv = ScanModel.ToCSV(this.scanSession.scannings.reverse(), this.exportOnlyText, this.enableQuotes, this.csvDelimiter, this.newLineCharacter.replace('CR', '\r').replace('LF', '\n'), this.enableHeaders);
    this.viewCtrl.dismiss(csv);
  }
}
