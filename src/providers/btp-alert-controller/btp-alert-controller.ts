import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AlertController, AlertOptions, Alert, NavOptions } from 'ionic-angular';
import { duration } from 'moment';

/*
  Generated class for the BtpAlertControllerProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class BtpAlertControllerProvider extends AlertController {
  create(options: AlertOptions): BTPAlert {
    options.enableBackdropDismiss = options.enableBackdropDismiss !== undefined ? options.enableBackdropDismiss : false;
    options.cssClass = options.cssClass ? `btpv2-alert ${options.cssClass}` : 'btpv2-alert';
    options.mode = options.mode ? options.mode : 'md';
    if (options.buttons) {
      options.buttons.forEach(button => {
        if (typeof button === 'object') {
          button.cssClass = button.cssClass ? `btpv2-btn ${button.cssClass}` : 'btpv2-btn';
          if (button.role === 'text-cancel') { button.cssClass = button.cssClass ? `${button.cssClass} btpv2-btn-text-cancel` : 'btpv2-btn-text-cancel'; }
          else if (button.role === 'cancel') button.cssClass = button.cssClass ? `${button.cssClass} btpv2-btn-cancel` : 'btpv2-btn-cancel';
          else button.cssClass = button.cssClass ? `${button.cssClass} btpv2-btn-primary` : 'btpv2-btn-primary';
        }
      });
    }
    return super.create(options);
  }
}

export class BTPAlert extends Alert {
  present(navOptions?: NavOptions): Promise<any> {
    navOptions.animate = navOptions.animate !== undefined ? navOptions.animate : true;
    navOptions.duration = navOptions.duration !== undefined ? navOptions.duration : 600;
    navOptions.easing = navOptions.easing !== undefined ? navOptions.easing : 'ease-in-out';
    return super.present(navOptions);
  }
}
