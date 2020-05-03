import { Component } from '@angular/core';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { LaunchReview } from '@ionic-native/launch-review';
import * as BluebirdPromise from 'bluebird';
import { AlertController, ItemSliding, NavController, PopoverController } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { discoveryResultModel } from '../../models/discovery-result';
import { requestModelDeleteScanSessions } from '../../models/request.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { ScanModel } from '../../models/scan.model';
import { Config } from '../../providers/config';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Utils } from '../../providers/utils';
import { ScanSessionPage } from '../scan-session/scan-session';
import { SelectServerPage } from '../select-server/select-server';
import { Settings } from './../../providers/settings';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  public connected = false;
  private onConnectSubscription: Subscription;
  private onDisconnectSubscription: Subscription;
  public scanSessions: ScanSessionModel[] = [];
  public selectedScanSessions: ScanSessionModel[] = [];

  private responseSubscription = null;
  private preventClickTimeout = null;
  private clickDisabled = false;

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private firebaseAnalytics: FirebaseAnalytics,
    private settings: Settings,
    private launchReview: LaunchReview,
    private serverProvider: ServerProvider,
    private utils: Utils,
  ) { }

  ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen('ScanSessionsPage');

    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
      if (Config.DEBUG && this.scanSessions && this.scanSessions.length == 0) {
        let scanSessionDate = new Date().getTime();
        for (let i = 0; i < 50; i++) {
          let scannings = [];
          scanSessionDate += Math.floor(Math.random() * 9999999) + 9999999;
          let scanDate = scanSessionDate;
          for (let j = 0; j < 500; j++) {
            let scan = new ScanModel();
            scan.cancelled = false;
            scan.id = scanDate;
            scan.date = scanDate;
            scan.repeated = false;
            scan.outputBlocks = [
              { name: 'BARCODE', value: j + ' - ' + Math.floor(Math.random() * 99999999999) + '', type: 'barcode' },
              { name: 'ENTER', value: 'tab', type: 'key' },
              { name: 'NUMBER', value: '5', type: 'variable' },
              { name: 'ENTER', value: 'enter', type: 'key' }];
            scan.displayValue = ScanModel.ToString(scan);
            scannings.push(scan);
            scanDate += Math.floor(Math.random() * 2000) + 1500;
          }
          let newScanSession: ScanSessionModel = {
            id: scanSessionDate,
            name: 'Scan session ' + i,
            date: scanSessionDate,
            scannings: scannings,
            selected: false,
          };
          this.scanSessions.push(newScanSession);
          // Looking for scanSessions.push? See: scanSessionsStorage.updateScanSession
        }
        this.scanSessionsStorage.setScanSessions(this.scanSessions)
      }
    });
  }

  ionViewWillUnload() {
    this.onConnectSubscription.unsubscribe();
    this.onDisconnectSubscription.unsubscribe();
  }

  ionViewDidLoad() {
    this.utils.askWiFiEnableIfDisabled();
    let everConnected = false;
    let isWatching = false;

    // Connect to the default server
    this.settings.getDefaultServer().then(defaultServer => {

      this.onDisconnectSubscription = this.serverProvider.onDisconnect().subscribe(() => {
        this.connected = false;
        // onDisconnect can be called also when there is an 'error'
        // So we need to make sure to not start another watchForServers()
        // subscription, since this 'error' may be caused from a connection
        // initialized inside the watch subscriber it self
        // Solution => use an external variable: isWatching
        if (isWatching) return;
        // delay 7001s to allow the serverProvider to perform a re-connect to the last ip
        isWatching = true;
        this.serverProvider.watchForServers().delay(7001).subscribe((discoveryResult: discoveryResultModel) => {
          // too late, abort
          if (this.connected) return;
          // if the server has the same name, but a different ip => ask to reconnect
          if (defaultServer.name == discoveryResult.server.name && discoveryResult.server.name.length && defaultServer.address != discoveryResult.server.address) {
            let alert = this.alertCtrl.create({
              title: "Reconnect",
              message: "It seems that the computer " + defaultServer.name + " changed ip address from \
                   " + defaultServer.address + " to " + discoveryResult.server.address + ", do you want to reconnect?",
              buttons: [{ text: 'No', role: 'cancel', handler: () => { } }, {
                text: 'Reconnect',
                handler: () => {
                  this.settings.setDefaultServer(discoveryResult.server); // override the defaultServer
                  this.settings.getSavedServers().then(savedServers => {
                    this.settings.setSavedServers(
                      savedServers
                        .filter(x => x.name != discoveryResult.server.name) // remove the old server
                        .concat(discoveryResult.server)) // add a new one
                  });
                  this.serverProvider.connect(discoveryResult.server, true);
                }
              }]
            });
            alert.present();
          } else if (defaultServer.name == discoveryResult.server.name && defaultServer.address == discoveryResult.server.address && everConnected) {
            // if the server was closed and open again => reconnect whitout asking
            this.serverProvider.connect(discoveryResult.server, true);
          }
        })
      });

      this.onConnectSubscription = this.serverProvider.onConnect().subscribe(() => {
        this.connected = true;
        everConnected = true;
        this.serverProvider.stopWatchForServers();
        isWatching = false;
        // Rating dialog
        BluebirdPromise.join(this.settings.getNoRunnings(), this.settings.getRated(), (runnings, rated) => {
          if (runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_RATING && !rated) {
            // rating = In app native rating (iOS 10.3+ only)
            // launch = Android and iOS 10.3-
            if (this.launchReview.isRatingSupported()) {
              // show native rating dialog
              this.launchReview.rating().then(result => {
                if (result === "dismissed") {
                  this.settings.setRated(true);
                }
              });
            } else {
              let store = this.utils.isAndroid() ? 'PlayStore' : 'Appstore';
              this.alertCtrl.create({
                title: 'Rate Barcode to PC',
                message: 'Is Barcode to PC helping you transfer barcodes?<br><br>Let the world know by rating it on the ' + store + ', it would be appreciated!',
                buttons: [
                  { text: 'Remind me later', role: 'cancel' },
                  { text: 'No', handler: () => { this.settings.setRated(true); } }, {
                    text: 'Rate',
                    handler: () => {
                      this.launchReview.launch().then(() => {
                        this.settings.setRated(true);
                      })
                    }
                  }]
              }).present();
            }
          }
        });
      });

      if (this.serverProvider.isConnected()) {
        // It may happen that the connection is already established from another
        // page, eg. WelcomePage
        this.connected = true;
      } else {
        // If instead we're launching the app, we must initiate a new connection
        this.serverProvider.connect(defaultServer);
      }

    }, err => { }) // getDefaultServer()

    this.settings.getOpenScanOnStart().then(openScanOnStart => {
      if (openScanOnStart) {
        this.navCtrl.push(ScanSessionPage);
      }
    });
  }

  ionViewDidLeave() {
    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
      this.responseSubscription = null;
    }
  }

  ionViewWillLeave() {
    this.unselectAll();
  }

  onSelectServerClick() {
    this.navCtrl.push(SelectServerPage);
  }

  onScanSessionClick(scanSession, index: number) {
    if (this.clickDisabled) return; // prevent click after long press

    if (this.selectedScanSessions.length == 0) {
      // this.cancelSelection();
      this.navCtrl.push(ScanSessionPage, { scanSession: scanSession });
    } else {
      this.select(scanSession, index);
    }
  }

  onSelectAllClick() {
    this.scanSessions.forEach(x => x.selected = true);
    this.selectedScanSessions = [].concat(this.scanSessions);
  }

  onScanSessionPress(scanSession: ScanSessionModel, index: number) {
    if (this.selectedScanSessions.length == 0) { // prevent click after long press
      if (this.preventClickTimeout) clearTimeout(this.preventClickTimeout);
      this.clickDisabled = true;
      this.preventClickTimeout = setTimeout(() => this.clickDisabled = false, 500);
    }

    this.select(scanSession, index);
  }

  onCancelSelectionClick() {
    this.unselectAll();
  }

  onDeleteClick(scanSession: ScanSessionModel, index: number, slidingItem: ItemSliding) {
    slidingItem.close();
    this.alertCtrl.create({
      title: 'Are you sure?',
      message: 'The scan session "' + scanSession.name + '" will be permanently deleted from both smartphone and server.\n\nIf instead you want to keep it only on the smartphone, use the archive button.',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          if (!this.connected) {
            this.utils.showCannotPerformActionOffline();
            return;
          }

          this.removeScanSession(index);
          this.save();
          this.sendDeleteScanSessions([scanSession]);
        }
      }]
    }).present();
  }

  private unselectAll() {
    this.selectedScanSessions.forEach(x => x.selected = false);
    this.selectedScanSessions = [];
  }

  private select(scanSession: ScanSessionModel, index: number) {
    if (scanSession.selected) {
      scanSession.selected = false;
      if (this.selectedScanSessions.length == 1) {
        this.selectedScanSessions = [];
      } else {
        this.selectedScanSessions.splice(index, 1);
      }
    } else {
      scanSession.selected = true;
      this.selectedScanSessions.push(scanSession);
    }
  }

  // ScanSessions.OnAddClick() -> ScanSession.GetScanMode()
  onAddClick() {
    this.navCtrl.push(ScanSessionPage);
  }

  onArchiveSelectedClick() {
    if (!this.connected) {
      this.utils.showCannotPerformActionOffline();
      return;
    }

    let wsRequest = new requestModelDeleteScanSessions().fromObject({
      scanSessionIds: this.selectedScanSessions.map(x => x.id)
    });
    this.serverProvider.send(wsRequest);

    this.scanSessions = this.scanSessions.filter(x => !x.selected);
    this.scanSessionsStorage.pushArchivedScanSessions(this.selectedScanSessions)
    this.unselectAll();
    this.save();
  }

  onDeleteSelectedClick() {
    this.alertCtrl.create({
      title: 'Are you sure?',
      message: 'The scan session will be permanently deleted from both smartphone and server.\n\nIf instead you want to keep it only on the smartphone, use the archive button.',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          if (!this.connected) {
            this.utils.showCannotPerformActionOffline();
            return;
          }

          this.sendDeleteScanSessions(this.selectedScanSessions);
          this.scanSessions = this.scanSessions.filter(x => !x.selected);
          this.unselectAll();
          this.save();
        }
      }]
    }).present();
  }

  // onClearScanSessionsClick() {
  //   this.alertCtrl.create({
  //     title: 'Confirm delete',
  //     message: 'Do you really want to delete ALL scan sessions?',
  //     buttons: [{
  //       text: 'Cancel', role: 'cancel'
  //     }, {
  //       text: 'Delete', handler: () => {
  //         if (!this.connected) {
  //           this.showCannotDeleteOffline();
  //           return;
  //         }

  //         this.scanSessions = [];
  //         this.save();
  //         this.sendClearScanSessions();
  //       }
  //     }]
  //   }).present();
  // }



  // private sendClearScanSessions() {
  //   this.serverProvider.send(new requestModelClearScanSessions().fromObject({}));
  // }

  private sendDeleteScanSessions(scanSessions: ScanSessionModel[]) {
    let wsRequest = new requestModelDeleteScanSessions().fromObject({
      scanSessionIds: scanSessions.map(x => { return x.id })
    });
    this.serverProvider.send(wsRequest);
  }

  private save() {
    console.log('[storage] setScanSessions() 1')
    this.scanSessionsStorage.setScanSessions(this.scanSessions);
  }

  private removeScanSession(index: number) {
    if (this.scanSessions.length == 1) {
      this.scanSessions = [];
    } else {
      this.scanSessions.splice(index, 1);
    }
  }
}
