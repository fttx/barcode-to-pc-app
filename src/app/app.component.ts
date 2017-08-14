import { Component, ViewChild } from '@angular/core';
import { Platform, MenuController, NavController, ModalController } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';

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
  @ViewChild('mainMenu') nav: NavController

  public rootPage;

  constructor(
    platform: Platform,
    splashScreen: SplashScreen,
    private settings: Settings,
    public menuCtrl: MenuController,
    public modalCtrl: ModalController,
  ) {
    platform.ready().then(() => {
      Promise.all([this.settings.getNoRunnings(), this.settings.getEverConnected(), this.settings.getAlwaysSkipWelcomePage()]).then((results: any[]) => {
        let runnings = results[0];
        let everConnected = results[1];
        let alwaysSkipWelcomePage = results[2];

        if ((!runnings || !everConnected) && !alwaysSkipWelcomePage) {
          this.rootPage = WelcomePage;
        } else {
          this.rootPage = ScanSessionsPage;
        }
        
        let newRunnings = runnings || 0;
        this.settings.setNoRunnings(++newRunnings);

        splashScreen.hide();
      });
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
