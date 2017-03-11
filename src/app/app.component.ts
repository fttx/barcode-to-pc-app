import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, Nav, AlertController, ModalController } from 'ionic-angular';
import { StatusBar, Splashscreen } from 'ionic-native';

import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { WelcomePage } from '../pages/welcome/welcome';
import { SelectServerPage } from './../pages/select-server/select-server';
import { AboutPage } from '../pages/about/about';
import { Settings } from '../providers/settings';
import { ContinueModeSettingsPage } from '../pages/continue-mode-settings/continue-mode-settings';

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
    Promise.all([
      this.settings.getNoRunnings().then(
        value => {
          if (!value) {
            this.rootPage = WelcomePage;
          } else {
            this.rootPage = ScanSessionsPage;
          }
          let runnings = value || 0;
          this.settings.setNoRunnings(++runnings);
        }
      ),

      platform.ready().then(() => {
        // Okay, so the platform is ready and our plugins are available.
        // Here you can do any higher level native things you might need.
        StatusBar.overlaysWebView(true);
        StatusBar.backgroundColorByHexString('#B71C1C');
      })
    ]).then(
      () => {
        Splashscreen.hide();
      })
  }

  scanSessions() {
    this.setPage(ScanSessionsPage, true);
  }

  selectServer() {
    this.setPage(SelectServerPage);
  }

  continueModeSettings() {
    this.menuCtrl.close();
    this.modalCtrl.create(ContinueModeSettingsPage).present();
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
