import { Injectable } from '@angular/core';
import { InAppBrowser, InAppBrowserObject } from '@ionic-native/in-app-browser/ngx';
import { Platform } from 'ionic-angular';

@Injectable()
export class BtpaInAppBrowser extends InAppBrowser {
  constructor(private platform: Platform) {
    super();
  }
  create(url: string, target?: string, options?: string): InAppBrowserObject {
    let urlObj = new URL(url);
    urlObj.searchParams.set('utm_source', 'app_' + this.platform.is('ios') ? 'ios' : 'android');
    urlObj.searchParams.set('utm_medium', 'app_open');
    urlObj.searchParams.set('utm_campaign', 'app_links_tracking');
    // urlObj.searchParams.set('utm_content', 'button_xyz');
    url = urlObj.toString();
    return super.create(url, target, options);
  }
}
