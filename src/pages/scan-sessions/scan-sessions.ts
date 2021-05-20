import { Component } from '@angular/core';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { LaunchReview } from '@ionic-native/launch-review';
import * as BluebirdPromise from 'bluebird';
import { AlertController, ItemSliding, NavController, Platform, PopoverController } from 'ionic-angular';
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
  private onConnectSubscription: Subscription;
  private onDisconnectSubscription: Subscription;
  public scanSessions: ScanSessionModel[] = [];
  public selectedScanSessions: ScanSessionModel[] = [];

  public connected = false;
  private everConnected = false;
  private isWatching = false;
  private preventClickTimeout = null;
  private clickDisabled = false;

  private unregisterBackButton = null;

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
    public platform: Platform,
  ) { }

  async ionViewDidEnter() {
    this.isWatching = false;
    this.serverProvider.stopWatchForServers();

    this.firebaseAnalytics.setCurrentScreen('ScanSessionsPage');

    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
    });

    this.unregisterBackButton = this.platform.registerBackButtonAction(() => {
      if (this.selectedScanSessions.length != 0) {
        this.unselectAll();
      } else {
        this.platform.exitApp();
      }
    }, 0);

    // WelcomePage and SelectServerPage can affect the connection status, so we
    // must pull the new status from the server provider.
    this.connected = this.serverProvider.isConnected();

    this.settings.getOfflineModeEnabled().then(offlineMode => {
      if (offlineMode) this.connected = false;
    })

    this.utils.askWiFiEnableIfDisabled();

    this.onDisconnectSubscription = this.serverProvider.onDisconnect().subscribe(() => {
      this.connected = false;
      // onDisconnect can be called also when there is an 'error'
      // So we need to make sure to not start another watchForServers()
      // subscription, since this 'error' may be caused from a connection
      // initialized inside the watch subscriber it self
      // Solution => use an external variable: isWatching
      if (this.isWatching) return;
      // delay 7001s to allow the serverProvider to perform a re-connect to the last ip
      this.isWatching = true;
      this.reconnect();
    });

    this.onConnectSubscription = this.serverProvider.onConnect().subscribe(() => {
      this.connected = true;
      this.everConnected = true;
      this.serverProvider.stopWatchForServers();
      this.isWatching = false;


      // // Detect unsynced scan sessions
      // let affectedIndexes = [];
      // for (let i = 0; i < this.scanSessions.length; i++) {
      //   const scanSession = this.scanSessions[i];
      //   const containsUnsynced = scanSession.scannings.findIndex(x => x.ack !== true) != -1;
      //   if (containsUnsynced) {
      //     affectedIndexes.push(i);
      //   }
      // }

      // if (affectedIndexes.length > 0) {
      //   const lastIndex = affectedIndexes[affectedIndexes.length - 1];
      //   const lastScanSession = this.scanSessions[lastIndex];
      //   this.alertCtrl.create({
      //     title: 'Unsynced scans',
      //     message: 'The following scan sessions contain unsynced scans:<br><br>' + affectedIndexes.map(x => '• ' + this.scanSessions[x].name).join('<br>') + '<br><br>Open the scan session and tap the Sync button to send them.',
      //     buttons: [
      //       {
      //         text: 'Open ' + lastScanSession.name,
      //         handler: () => {
      //           this.onScanSessionClick(lastScanSession, lastIndex);
      //         }
      //       },
      //       { text: 'Dismiss', role: 'cancel' },
      //     ]
      //   }).present();
      // }


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
            this.alertCtrl.create({
              title: 'Rate Barcode to PC',
              message: 'Let other users know what you achieved with Barcode to PC',
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

    this.reconnect();
  }

  ionViewWillUnload() {
    this.onConnectSubscription.unsubscribe();
    this.onDisconnectSubscription.unsubscribe();
  }

  async reconnect() {
    let offlineMode = await this.settings.getOfflineModeEnabled();
    if (offlineMode) return;

    let defaultServer = await this.settings.getDefaultServer();
    this.serverProvider.watchForServers().delay(defaultServer == null ? 0 : 8000).subscribe((discoveryResult: discoveryResultModel) => {
      // too late, abort
      if (this.connected) return;
      // if the server has the same name, but a different ip => ask to reconnect
      if (defaultServer != null && defaultServer.name == discoveryResult.server.name && discoveryResult.server.name.length && defaultServer.address != discoveryResult.server.address) {
        setTimeout(() => {
          // We add a 3s delay just in case the defaultServer address gets announced
          // later, this way it has enough time to connect to it before prompting
          // the user.
          if (this.serverProvider.isConnected()) return;
          this.alertCtrl.create({
            title: "Reconnect",
            message: "It seems that the computer " + defaultServer.name + " changed ip address from " + defaultServer.address + " to " + discoveryResult.server.address + ", do you want to reconnect?",
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
          }).present();
        }, 3000);
      } else if (defaultServer == null || (defaultServer.name == discoveryResult.server.name && defaultServer.address == discoveryResult.server.address && this.everConnected)) {
        // if the server was closed and open again => reconnect whitout asking
        this.serverProvider.connect(discoveryResult.server, true);
      }
    }); // END watchForServers()

    if (this.serverProvider.isConnected()) {
      // It may happen that the connection is already established from another
      // page, eg. WelcomePage
      this.connected = true;
    } else if (defaultServer != null) {
      // If instead we're launching the app, we must initiate a new connection
      this.serverProvider.connect(defaultServer);
    }
  }


  async ionViewDidLoad() {
    this.settings.getOpenScanOnStart().then(openScanOnStart => {
      if (openScanOnStart) {
        this.navCtrl.push(ScanSessionPage);
      }
    });
  }

  ionViewDidLeave() {
    if (this.unregisterBackButton != null) {
      this.unregisterBackButton();
      this.unregisterBackButton = null;
    }

    if (this.onDisconnectSubscription != null) {
      this.onDisconnectSubscription.unsubscribe();
      this.onDisconnectSubscription = null;
    }

    if (this.onConnectSubscription != null) {
      this.onConnectSubscription.unsubscribe();
      this.onConnectSubscription = null;
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
      message: 'The scan session "' + scanSession.name + '" will be permanently deleted.\n\nIf instead you want to keep it on the smartphone, use the archive button.',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          if (this.blockOfflineOperationIfcontainsSyncedScans([this.scanSessions[index]])) return;

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
    if (this.blockOfflineOperationIfcontainsSyncedScans(this.selectedScanSessions)) return;

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
          if (this.blockOfflineOperationIfcontainsSyncedScans(this.selectedScanSessions)) return;

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

  private blockOfflineOperationIfcontainsSyncedScans(scanSessions: ScanSessionModel[], alert: boolean = true) {
    for (let i = 0; i < scanSessions.length; i++) {
      const scanSession = scanSessions[i];
      const ackIndex = scanSession.scannings.findIndex(x => x.ack);
      if (ackIndex != -1 && !this.connected) {
        if (alert) {
          this.alertCtrl.create({
            title: 'Cannot perform this action while offline',
            message: 'The selected scan session(s) has already been partially synced. Please connect the app to the server',
            buttons: [{
              text: 'Ok', role: 'cancel'
            }]
          }).present();
        }
        return true;
      }
    }
    return false;
  }
}
