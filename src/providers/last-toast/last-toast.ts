import { Injectable } from '@angular/core';
import { Platform, Toast, ToastController } from 'ionic-angular';
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
  private lastToastObject: Toast = null;
  private destroyTimeout = null;

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

  public present(message: string, duartion: number = 6000, position: 'top' | 'bottom' = 'bottom') {
    if (Config.DEBUG) {
      duartion = 2500;
    }

    if (document.visibilityState == 'hidden') {
      this.paused = true;
    }

    if (!this.paused) {
      if (this.lastToastObject != null && this.destroyTimeout != null) {
        // Reuse existing toast
        clearTimeout(this.destroyTimeout);
        this.destroyTimeout = null;
        this.lastToastObject.setMessage(message);
        this.lastToastObject.setDuration(2000 + duartion);
        this.lastToastObject.setPosition(position);
      } else {
        // Create new toast
        this.lastToastObject = this.toastCtrl.create({ message: message, duration: duartion, showCloseButton: true, closeButtonText: 'DISMISS', position: position });
        this.lastToastObject.onDidDismiss(() => {
          this.lastToastObject = null;
          this.destroyTimeout = null;
        });
        this.lastToastObject.present();
      }
      this.destroyTimeout = setTimeout(() => {
        this.lastToastObject = null;
        this.destroyTimeout = null;
      }, duartion);
      this.lastToastMessage = null;
    } else {
      this.lastToastMessage = message;
    }
  }

}
