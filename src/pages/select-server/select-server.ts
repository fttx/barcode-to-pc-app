import { Component } from '@angular/core';
import { BarcodeScanner } from '@fttx/barcode-scanner';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { Promise as BluebirdPromise } from 'bluebird';
import { ActionSheetController, AlertController, NavController, Platform, ViewController } from 'ionic-angular';
import { MyApp } from '../../app/app.component';
import { ScanModel } from '../../models/scan.model';
import { wsEvent } from '../../models/ws-event.model';
import { Config } from '../../providers/config';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { Utils } from '../../providers/utils';
import { ServerModel } from './../../models/server.model';

@Component({
  selector: 'page-select-server',
  templateUrl: 'select-server.html',

})

export class SelectServerPage {
  private wsEventsSubscription;
  public selectedServer: ServerModel;
  public servers: ServerModel[] = [];
  // private lastConnectedServer: ServerModel;

  private cannotFindServerTimeout = null;

  constructor(
    public navCtrl: NavController,
    public viewCtrl: ViewController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private settings: Settings,
    private firebaseAnalytics: FirebaseAnalytics,
    private barcodeScanner: BarcodeScanner,
    private utils: Utils,
    public actionSheetCtrl: ActionSheetController,
    public platform: Platform,
    private iab: InAppBrowser,
  ) { }

  public isVisible = false;
  public offlineMode = false;

  async ionViewDidEnter() {
    this.firebaseAnalytics.setCurrentScreen("SelectServerPage");
    this.isVisible = true;
    this.init(await this.settings.getOfflineModeEnabled());
  }

  ionViewDidLeave() {
    this.isVisible = false;
    this.serverProvider.stopWatchForServers();
    if (this.wsEventsSubscription) this.wsEventsSubscription.unsubscribe();
    if (this.cannotFindServerTimeout) clearTimeout(this.cannotFindServerTimeout);
  }

  onSelectServerChanged() {
    if (this.selectedServer) {
      this.settings.setDefaultServer(this.selectedServer);
      console.log("SELSER: onSelectServerChanged() -> ", this.selectedServer);
      this.connect(this.selectedServer);
    }
  }

  onScanQRCodeClicked() {
    this.init(false);
    this.barcodeScanner.scan({
      "showFlipCameraButton": true,
      formats: "QR_CODE"
    }).subscribe((scan: ScanModel) => {
      if (scan && scan.text) {
        let servers = ServerModel.serversFromJSON(scan.text);
        servers.forEach(server => this.addServer(server, true, true));
        this.setSelectedServer(servers[0]);
      }
    }, err => { });
  }

  async onAddManuallyClicked() {
    this.init(false);
    let alert = this.alertCtrl.create({
      title: await this.utils.text('addManuallyDialogButton'),
      inputs: [{
        name: await this.utils.text('addManuallyDialogNameInput'),
        placeholder: await this.utils.text('addManuallyDialogInputPlaceholder')
      }, {
        name: await this.utils.text('addManuallyDialogAddressInput'),
        placeholder: await this.utils.text('addManuallyDialogAddressInputPlaceholder'),
      }],
      buttons: [{
        text: await this.utils.text('addManuallyDialogCancelButton'),
        role: 'cancel'
      }, {
        text: await this.utils.text('addManuallyDialogAddButton'),
        handler: input => {
          if (!input.address) {
            return;
          }
          let server = new ServerModel(input.address, input.name);
          this.addServer(server, false, true);
          // this.settings.setDefaultServer(server);
          // this.setSelectedServer(server);
          this.settings.saveServer(server);
        }
      }]
    });
    alert.present();
  }

  scanForServers() {
    this.serverProvider.watchForServers().subscribe(data => {
      let server = data.server;
      if (data.action == 'added' || data.action == 'resolved') {
        this.addServer(server, true, false);
      } else {
        // this.setOnline(server, false);
      }
    });

    if (this.cannotFindServerTimeout) clearTimeout(this.cannotFindServerTimeout);
    this.cannotFindServerTimeout = setTimeout(async () => {
      let onlineServers = this.servers.find(x => x.online != 'offline');
      if (!onlineServers) {
        let alert = this.alertCtrl.create({
          title: await this.utils.text('cantFindServerDialogTitle'),
          message: await this.utils.text('cantFindServerDialogMessage', {
            "serverProgramName": MyApp.SERVER_PROGRAM_NAME
          }),
          buttons: [{
            text: await this.utils.text('cantFindServerCloseButton'),
            role: 'cancel',
            handler: () => { }
          }, {
            text: await this.utils.text('cantFindServerHelpButton'),
            handler: () => {
              this.iab.create('mailto:' + Config.EMAIL_SUPPORT, '_system');
            }
          }, {
            text: await this.utils.text('cantFindServerScanAgainButton'),
            handler: () => {
              this.servers.forEach(x => x.online = 'offline');
              this.init(false);
            }
          }]
        });
        alert.present();
      }
    }, Config.SHOW_CANNOT_FIND_DIALOG_TIMEOUT)
  } // scanForServers

  addServers(servers: ServerModel[], forceOnline: boolean, forceNameUpdate: boolean) {
    servers.forEach(server => {
      this.addServer(server, forceOnline, forceNameUpdate);
    });
  }

  addServer(addServer: ServerModel, forceOnline: boolean, forceNameUpdate: boolean) {
    let found = false;
    this.servers.forEach(server => {
      if (server.equals(addServer)) {
        found = true;
        if (forceOnline) {
          if (server.online != 'connected') {
            server.online = 'online';

            if (this.selectedServer && this.selectedServer.equals(server) && this.serverProvider.isReconnecting()) {
              this.connect(this.selectedServer);
            }
          }
        }
      }

      // if (addServer.equals(this.selectedServer)) { // radio fix
      //     console.log('[SEL-SER]forcing online 2')
      //     server.online = 'online';
      //     // this.selectedServer = server; // server is part of this.servers list, and will highlight the radio button
      // }
    });

    if (!found) {
      if (forceOnline) {
        console.log('[SEL-SER]forcing online 3')
        if (addServer.online != 'connected') {
          addServer.online = 'online';
        }
      }
      this.servers.push(addServer);
    }
  }


  deleteServer(server) {
    if (this.selectedServer && server.equals(this.selectedServer)) {
      this.serverProvider.disconnect();
      if (this.wsEventsSubscription) {
        this.wsEventsSubscription.unsubscribe();
        this.wsEventsSubscription = null;
      }
    }

    this.settings.getDefaultServer().then(defaultServer => {
      if (defaultServer != null && defaultServer.equals(server)) {
        this.settings.setDefaultServer(null);
      }
    }).catch(() => { })
      .then(() => {
        this.settings.deleteServer(server);
        this.servers.splice(this.servers.indexOf(server), 1);
      })
    // if (this.selectedServer && this.selectedServer.equals(server)) {
    //     if (this.servers.length) {
    //         this.setSelectedServer(this.servers[0]);
    //         this.settings.setDefaultServer(this.selectedServer);
    //     }
    // }
  }


  setOnline(server: ServerModel, online: ('online' | 'offline' | 'connected')) {
    let s = this.servers.find(x => x.equals(server));
    if (s) {
      s.online = online;
    }
  }

  connect(server: ServerModel) {
    if (this.wsEventsSubscription) {
      this.wsEventsSubscription.unsubscribe();
      this.wsEventsSubscription = null;
      this.servers.forEach(x => {
        if (x.online == 'connected') {
          x.online = 'online';
        }
      })
    }
    this.wsEventsSubscription = this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
      if (event.ws.url.indexOf(server.address) == -1) return;
      if (event.ws.url.indexOf(server.address) != -1) {
        if (event.name == wsEvent.EVENT_OPEN || event.name == wsEvent.EVENT_ALREADY_OPEN) {
          this.setOnline(server, 'connected');
        } else {
          this.setOnline(server, 'offline')
        }
      }
    });
    this.serverProvider.connect(server, true);
  }

  setSelectedServer(server: ServerModel) {
    let s = this.servers.find(x => x.equals(server));
    if (s) {
      this.selectedServer = s;
      this.onSelectServerChanged();
    }
  }

  async rename(server: ServerModel) {
    this.alertCtrl.create({
      title: await this.utils.text('renameDialogTitle'),
      // message: 'Inse',
      enableBackdropDismiss: false,
      inputs: [{ name: await this.utils.text('renameDialogNameInput'), type: 'text', placeholder: await this.utils.text('renameDialogNameInputPlaceholder'), value: server.name }],
      buttons: [{
        role: 'cancel', text: await this.utils.text('renameDialogCancelButton'),
        handler: () => { }
      }, {
        text: await this.utils.text('renameDialogOkButton'),
        handler: data => {
          if (data.name != "") {
            server.name = data.name;
            this.settings.setSavedServers(this.servers);
          }
        }
      }]
    }).present();
  }

  async info(server: ServerModel) {
    let status = await this.utils.text('serverStatusOffline');
    if (server.online == 'online') {
      status = await this.utils.text('serverStatusOnline');
    } else if (server.online == 'connected') {
      status = await this.utils.text('serverStatusConnected')
    }
    this.alertCtrl.create({
      title: await this.utils.text('serverInfoDialogTitle'),
      message: await this.utils.text('serverInfoDialogMessage', { "server": (server.name || server.address), "status": status }),

      buttons: [await this.utils.text('serverInfoDialogOkButton')],
    }).present();
  }

  async onItemPressed(server: ServerModel, i: number) {
    // if (this.platform.is('ios')) {
    //   // Use sliding item
    //   return;
    // }

    this.actionSheetCtrl.create({
      title: server.name || server.address,
      buttons: [
        { text: await this.utils.text('removeButton'), icon: 'trash', role: 'destructive', handler: () => { this.deleteServer(server); } },
        { text: await this.utils.text('renameButton'), icon: 'create', handler: () => { this.rename(server); } },
        { text: await this.utils.text('infoButton'), icon: 'information-circle', handler: () => { this.info(server); } },
        { text: await this.utils.text('closeButton'), role: 'cancel', handler: () => { } }]
    }).present();
  }

  init(offlineMode: boolean) {
    // clear variables
    this.servers = [];
    if (this.wsEventsSubscription) this.wsEventsSubscription.unsubscribe();
    this.wsEventsSubscription = null;
    this.selectedServer = null;
    this.offlineMode = offlineMode;

    this.settings.setOfflineModeEnabled(offlineMode);

    if (offlineMode) {
      this.serverProvider.stopWatchForServers();
      this.serverProvider.disconnect();
    } else {
      this.scanForServers();
      BluebirdPromise.join(this.settings.getSavedServers(), this.settings.getDefaultServer(), (savedServers, defaultServer) => {
        this.addServers(savedServers, false, true);
        if (defaultServer != null) this.addServer(defaultServer, false, false);
        this.setSelectedServer(defaultServer);
      });
      this.utils.askWiFiEnableIfDisabled();
    }
  }

  getServerColor(server: ServerModel) {
    if (server.online == 'offline')
      return 'rgba(0,0,0,0.5)';
    if (server.online == 'online')
      return 'rgba(0,0,0,0.5)';
    if (server.online == 'connected')
      return 'rgba(101, 184, 106,1)';
  }

  getServerIcon(server: ServerModel) {
    if (server.online == 'offline')
      return 'ios-close-circle-outline'
    return 'desktop';
  }
}
