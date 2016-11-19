import { Component } from '@angular/core';
import { ViewController } from 'ionic-angular';
import { NavController } from 'ionic-angular';
import { AboutPage } from '../about/about'

@Component({
    template: `
      <button ion-item (click)="about()">About</button>
  `
})
export class ScanSessionsPopover {
    constructor(
        public viewCtrl: ViewController,
        public navCtrl: NavController,
    ) { }

    about() {
        this.viewCtrl.dismiss();
        this.navCtrl.push(AboutPage);
    }
}