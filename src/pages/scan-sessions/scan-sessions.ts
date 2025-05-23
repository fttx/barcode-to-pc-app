import { Component, NgZone, ViewChild } from '@angular/core';
import { LaunchReview } from '@ionic-native/launch-review';
import * as BluebirdPromise from 'bluebird';
import { Events, ItemSliding, NavController, Platform, PopoverController } from 'ionic-angular';
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
import { Device } from '@ionic-native/device';
import { LastToastProvider } from '../../providers/last-toast/last-toast';
import { BtpToastService } from '../../components/btp-toast/btp-toast.service';
import { BtpAlertController } from '../../providers/btp-alert-controller/btp-alert-controller';
import { BtpaInAppBrowser } from '../../providers/btpa-in-app-browser/btpa-in-app-browser';
import * as oc from '@primer/octicons';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  octicons = oc;
  iconCloudOnline = this.sanitizer.bypassSecurityTrustHtml(oc['cloud'].toSVG());
  iconCloudOffline = this.sanitizer.bypassSecurityTrustHtml(oc['cloud-offline'].toSVG());
  iconCheck = this.sanitizer.bypassSecurityTrustHtml(oc['check'].toSVG());

  private onConnectSubscription: Subscription;
  private onDisconnectSubscription: Subscription;
  public scanSessions: ScanSessionModel[] = [];
  public selectedScanSessions: ScanSessionModel[] = [];
  public serverLessMode = false;

  private everConnected = false;
  private isWatching = false;
  private preventClickTimeout = null;
  private clickDisabled = false;
  private reconnectDialog = null;
  private unregisterBackButton = null;
  private ratingDialogShown = false;
  private ratingAlert = null;

  private cloudReachable = false;


  public connectionStatus: 'offline' | 'online' | 'connecting' = 'connecting';

  constructor(
    public navCtrl: NavController,
    private alertCtrl: BtpAlertController,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private settings: Settings,
    private launchReview: LaunchReview,
    private serverProvider: ServerProvider,
    private utils: Utils,
    public platform: Platform,
    private device: Device,
    private iab: BtpaInAppBrowser,
    public events: Events,
    public lastToast: LastToastProvider,
    private ngZone: NgZone,
    private btpToastCtrl: BtpToastService,
    public sanitizer: DomSanitizer
  ) {
  }

  private async isCloudReachable(): Promise<boolean> {
    try {
      const response = await fetch(Config.URL_CLOUD_PING, { method: 'GET', cache: 'no-store' });
      this.cloudReachable = response.ok;
    } catch (error) {
      this.cloudReachable = false;
    }
    return this.cloudReachable;
  }

  private async startCloudReachabilityCheck() {
    if (await this.settings.getEnableServerlessMode()) {
      this.isCloudReachable();
      setInterval(() => this.isCloudReachable(), 30000);
    }
  }

  async ionViewDidEnter() {
    this.isWatching = false;
    this.serverProvider.stopWatchForServers();

    window.cordova.plugins.firebase.analytics.setCurrentScreen('ScanSessionsPage');

    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
    });

    this.connectionStatus = this.serverProvider.isConnected() ? 'online' : 'offline';
    this.events.unsubscribe('connection');
    this.events.subscribe('connection', async (status, server) => {
      this.ngZone.run(() => {
        this.connectionStatus = status;
      });
    });

    // PDA Dialog
    const manufacturer = (this.device.manufacturer || '').toLowerCase();
    const pdaManufacturers = ['zebra', 'chainway', 'honeywell', 'datalogic', 'intermec', 'point', 'bluebird', 'm3', 'newland'];
    if (pdaManufacturers.filter(x => manufacturer.indexOf(x) != -1).length > 0) {
      let isPDADevicedialogShown = await this.settings.getIsPDADeviceDialogShown();
      if (!isPDADevicedialogShown) {
        this.alertCtrl.create({
          title: await this.utils.text('isPDADeviceDialogTitle2'),
          message: await this.utils.text('isPDADeviceDialogMessage2', { brand: this.device.manufacturer }),
          buttons: [
            {
              text: await this.utils.text('isPDADeviceDialogMoreInfoButton'), handler: () => {
                this.settings.setIsPDADeviceDialogShown(true);
                this.settings.setIsPDADevice(true);
                this.iab.create(Config.DOCS_ANDROID_PDA, '_system');
              }
            },
            {
              text: await this.utils.text('isPDADeviceDialogNoButton'), handler: () => {
                this.settings.setIsPDADeviceDialogShown(true);
              }, role: 'cancel'
            },
            { text: await this.utils.text('isPDADeviceDialogShowLaterButton'), role: 'cancel', handler: () => { } },
          ]
        }).present();
      }
    }

    this.unregisterBackButton = this.platform.registerBackButtonAction(() => {
      if (this.selectedScanSessions.length != 0) {
        this.unselectAll();
      } else {
        this.platform.exitApp();
      }
    }, 0);

    // WelcomePage and SelectServerPage can affect the connection status, so we
    // must pull the new status from the server provider.

    this.settings.getOfflineModeEnabled().then(offlineMode => {
      if (offlineMode) this.connectionStatus = 'offline';
    })

    if (!this.settings.getSkipWiFiCheck()) this.utils.askWiFiEnableIfDisabled();
    // christian@sennhauser-its.ch
    // if (!this.serverProvider.isConnected()) {
    //   this.utils.askWiFiEnableIfDisabled();
    // }

    this.serverLessMode = await this.settings.getEnableServerlessMode();

    this.onDisconnectSubscription = this.serverProvider.onDisconnect().subscribe(() => {
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
      this.everConnected = true;
      this.serverProvider.stopWatchForServers();
      this.isWatching = false;
      if (this.reconnectDialog) {
        this.reconnectDialog.dismiss();
        this.reconnectDialog = null;
      }

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
      BluebirdPromise.join(this.settings.getNoRunnings(), this.settings.getRated(), async (runnings, rated) => {
        if (!this.ratingDialogShown && runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_RATING && !rated && !this.serverProvider.catchUpIOSLag) {
          // rating = In app native rating (iOS 10.3+ only)
          // launch = Android and iOS 10.3-
          if (this.launchReview.isRatingSupported()) {
            // show native rating dialog
            this.launchReview.rating().then(result => {
              this.ratingDialogShown = true;
              if (result === "dismissed") {
                this.settings.setRated(true);
              }
            });
          } else {
            if (this.ratingAlert) this.ratingAlert.dismiss();
            this.ratingAlert = this.alertCtrl.create({
              title: await this.utils.text('rateBarcodeToPcDialogTitle', {
                "appName": await this.utils.text('appName'),
              }),
              message: await this.utils.text('rateBarcodeToPcDialogMessage', {
                "appName": await this.utils.text('appName'),
              }),
              buttons: [
                {
                  text: await this.utils.text('rateBarcodeToPcDialogRateButton'),
                  handler: () => {
                    this.launchReview.launch().then(() => {
                      this.settings.setRated(true);
                    })
                  }
                },
                { text: await this.utils.text('rateBarcodeToPcDialogNoButton'), role: 'cancel', handler: () => { this.settings.setRated(true); } },
                { text: await this.utils.text('rateBarcodeToPcDialogremindMeLaterButton'), role: 'cancel' },
              ]
            });
            this.ratingAlert.present();
          }
        }
      });
    });

    this.reconnect();
    this.startCloudReachabilityCheck();
  }

  ionViewWillUnload() {
    if (this.onConnectSubscription != null) {
      this.onConnectSubscription.unsubscribe();
    }
    if (this.onDisconnectSubscription != null) {
      this.onDisconnectSubscription.unsubscribe();
    }
  }

  async reconnect() {
    let offlineMode = await this.settings.getOfflineModeEnabled();
    if (offlineMode) return;

    let defaultServer = await this.settings.getDefaultServer();
    this.serverProvider.watchForServers().delay(defaultServer == null ? 0 : 8000).subscribe((discoveryResult: discoveryResultModel) => {
      // too late, abort
      if (this.connectionStatus === 'online') return;
      // if the server has the same name, but a different ip => ask to reconnect
      if (defaultServer != null && defaultServer.name == discoveryResult.server.name && discoveryResult.server.name.length && defaultServer.getAddress() != discoveryResult.server.getAddress()) {
        setTimeout(async () => {
          // We add a 5s delay just in case the defaultServer address gets announced
          // later, this way it has enough time to connect to it before prompting
          // the user.
          if (this.serverProvider.isConnected()) return;
          if (this.reconnectDialog == null) {
            this.reconnectDialog = this.alertCtrl.create({
              title: await this.utils.text('reconnectDialogTitle'),
              message: await this.utils.text('reconnectDialogMessage', { "defaultServerName": defaultServer.name, "defaultServerAddress": defaultServer.getAddress(), "discoveryServerAddress": discoveryResult.server.getAddress() }),
              buttons: [{
                text: await this.utils.text('reconnectDialogReconnectButton'),
                handler: () => {
                  this.settings.setDefaultServer(discoveryResult.server); // override the defaultServer
                  this.settings.getSavedServers().then(savedServers => {
                    this.settings.setSavedServers(
                      savedServers
                        .filter(x => x.name != discoveryResult.server.name) // remove the old server
                        .concat(discoveryResult.server)) // add a new one
                  });
                  this.serverProvider.connect(discoveryResult.server, true);
                  this.reconnectDialog = null;
                }
              },
              { text: await this.utils.text('reconnectDialogNoButton'), role: 'cancel', handler: () => { this.reconnectDialog = null; } }],
              enableBackdropDismiss: false,
            });
            this.reconnectDialog.present();
          }
        }, 5000);
      } else if (defaultServer == null || (defaultServer.name == discoveryResult.server.name && defaultServer.getAddress() == discoveryResult.server.getAddress() && this.everConnected)) {
        // if the server was closed and open again => reconnect whitout asking
        this.serverProvider.connect(discoveryResult.server, true);
      }
    }); // END watchForServers()

    if (this.serverProvider.isConnected()) {
      // It may happen that the connection is already established from another
      // page, eg. WelcomePage
      this.connectionStatus = 'online';
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

  async onDeleteClick(scanSession: ScanSessionModel, index: number, slidingItem: ItemSliding) {
    slidingItem.close();
    this.alertCtrl.create({
      title: await this.utils.text('scanSessionDeleteDialogTitle'),
      message: await this.utils.text('scanSessionDialogMessage', { "scanSessionName": scanSession.name }),
      buttons: [{
        text: await this.utils.text('scanSessionDialogCancelButton'), role: 'cancel'
      }, {
        text: await this.utils.text('scanSessionDialogDeleteButton'), handler: () => {
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
    this.scanSessions = this.scanSessions.filter(x => !x.selected);
    this.scanSessionsStorage.pushArchivedScanSessions(this.selectedScanSessions)
    this.save();
    this.sendDeleteScanSessions(this.selectedScanSessions);
    this.unselectAll();
  }

  async onDeleteSelectedClick() {
    this.alertCtrl.create({
      title: await this.utils.text('scanSessionPermanentDeleteDialogTitle'),
      message: (await this.utils.text('scanSessionPermanentDeleteDialogMessage')),
      buttons: [{
        text: await this.utils.text('scanSessionPermanentDeleteCancelButton'), role: 'cancel'
      }, {
        text: await this.utils.text('scanSessionPermanentDeleteDeleteButton'), handler: () => {
          this.scanSessions = this.scanSessions.filter(x => !x.selected);
          this.save();
          this.sendDeleteScanSessions(this.selectedScanSessions);
          this.unselectAll();
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

  private async sendDeleteScanSessions(scanSessions: ScanSessionModel[]) {
    if (this.connectionStatus !== 'online') {
      let wsRequest = new requestModelDeleteScanSessions().fromObject({
        scanSessionIds: scanSessions.map(x => { return x.id })
      });
      this.serverProvider.send(wsRequest);
    } else {
      // If the user deletes a scan sessions while offline it won't get deleted from the server
      // resulting in an inconsistency between the app and the server UI. Solution => Save the scan session id to sync it later

      // Get the affected servers UUID that need to be notified later
      // .reduce(...) is like .flat()
      // .filter(...) is like .unique()
      let serverUUIDs = scanSessions.map(x => x.syncedWith).reduce((accumulator, value) => accumulator.concat(value), []).filter((value, index, self) => { return self.indexOf(value) === index; })
      for (let i = 0; i < serverUUIDs.length; i++) {
        const serverUUID = serverUUIDs[i];

        // Add the scanSession id to the server' unsynced list
        let deletedIds = await this.settings.getUnsyncedDeletedScanSesions(serverUUID);
        deletedIds.push(...scanSessions.filter(x => x.syncedWith.indexOf(serverUUID) != -1).map(x => x.id));
        this.settings.setUnsyncedDeletedScanSesions(serverUUID, deletedIds);
      }

      // Since we're deleting the scan session doesn't matter if it was previously restored => clear the list
      let restoredIds = await this.settings.getUnsyncedRestoredScanSesions();
      restoredIds = restoredIds.filter(x => scanSessions.map(y => y.id).indexOf(x) == -1)
      this.settings.setUnsyncedRestoredScanSesions(restoredIds);
    }
  }

  private save() {
    this.scanSessionsStorage.setScanSessions(this.scanSessions);
  }

  private removeScanSession(index: number) {
    if (this.scanSessions.length == 1) {
      this.scanSessions = [];
    } else {
      this.scanSessions.splice(index, 1);
    }
  }

  private isKicked() {
    return this.serverProvider.kickedOut;
  }
}
