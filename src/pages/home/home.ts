import { Component } from '@angular/core';

import { NavController } from 'ionic-angular';
import { ScanModel } from '../../models/scan.model'
import { ScanPage } from '../scan/scan'

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  public scannings: ScanModel[];

  constructor(public navCtrl: NavController) {
    this.scannings = [{
      name: 'agagaga',
      date: new Date(),
      noElements: 0
    }, {
      name: 'qwerasfdag',
      date: new Date(),
      noElements: 0
    }, {
      name: 'wwwwwwwww',
      date: new Date(),
      noElements: 0
    }, {
      name: 'dsfasfasd',
      date: new Date(),
      noElements: 0
    }, {
      name: 'asdasd',
      date: new Date(),
      noElements: 0
    }, {
      name: 'ewrfwefsdaf',
      date: new Date(),
      noElements: 0
    }];
  }

  itemSelected(scan) {
    this.navCtrl.push(ScanPage);
  }
}
