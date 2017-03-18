import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, Nav, AlertController, ModalController } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { WelcomePage } from '../pages/welcome/welcome';
import { SelectServerPage } from './../pages/select-server/select-server';
import { AboutPage } from '../pages/about/about';
import { Settings } from '../providers/settings';
import { SettingsPage } from '../pages/settings/settings';

@Component({
  templateUrl: 'app.html',
})
export class MyApp {
  @ViewChild(Nav) nav: Nav;

  public rootPage;

  constructor(
    platform: Platform,
    private settings: Settings,
    public menuCtrl: MenuController,
    private alertCtrl: AlertController,
    public modalCtrl: ModalController,
  ) {

    platform.ready().then(() => {
      StatusBar.overlaysWebView(true);
      StatusBar.backgroundColorByHexString('#B71C1C');

      this.settings.getNoRunnings().then(runnings => {
        if (!runnings) {
          this.rootPage = WelcomePage;
        } else {
          this.rootPage = ScanSessionsPage;
        }
        let newRunnings = runnings || 0;
        this.settings.setNoRunnings(++newRunnings);
      });

      Splashscreen.hide();
    });
  }

  scanSessions() {
    this.setPage(ScanSessionsPage, true);
  }

  selectServer() {
    this.setPage(SelectServerPage);
  }

  settingsPage() {
    this.menuCtrl.close();
    this.modalCtrl.create(SettingsPage).present();
  }

  about() {
    this.setPage(AboutPage);
  }

  setPage(page, isRoot = false) {
    if (this.nav.getActive().name != page.name) {
      this.menuCtrl.close();
      if (isRoot) {
        this.nav.setRoot(page);
      } else {
        this.nav.push(page);
      }
    } else {
      this.menuCtrl.close();
    }
  }
}
