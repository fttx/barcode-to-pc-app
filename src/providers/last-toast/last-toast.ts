import { Injectable } from '@angular/core';
import { Platform, ToastController } from 'ionic-angular';
import { Config } from '../config';

/*
  Generated class for the LastToastProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class LastToastProvider {


  private paused = false;
  private lastToastMessage: string;

  constructor(
    public platform: Platform,
    public toastCtrl: ToastController,
  ) {
    platform.pause.subscribe(() => {
      this.paused = true;
    });

    platform.resume.subscribe(() => {
      this.paused = false;
      if (this.lastToastMessage && this.lastToastMessage.length) {
        this.present(this.lastToastMessage);
      }
    });
  }

  public present(message: string, duartion: number = 6000, position = 'bottom') {
    if (Config.DEBUG) {
      duartion = 2500;
    }

    if (document.visibilityState == 'hidden') {
      this.paused = true;
    }

    if (!this.paused) {
      this.toastCtrl.create({ message: message, duration: duartion, showCloseButton: true, closeButtonText: 'DISMISS', position: position }).present();
      this.lastToastMessage = null;
    } else {
      this.lastToastMessage = message;
    }
  }

}
