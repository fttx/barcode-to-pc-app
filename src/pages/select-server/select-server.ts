import { Component } from '@angular/core';
import { BarcodeScanner } from '@fttx/barcode-scanner';
import { Device } from '@ionic-native/device';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { Promise } from 'bluebird';
import { AlertController, NavController, ViewController } from 'ionic-angular';

import { ScanModel } from '../../models/scan.model';
import { wsEvent } from '../../models/ws-event.model';
import { Config } from '../../providers/config';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { Settings } from '../../providers/settings';
import { ServerModel } from './../../models/server.model';

/*
  Generated class for the SelectServer page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
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
    private ga: GoogleAnalytics,
    private barcodeScanner: BarcodeScanner,
    private scanSessionsStorage: ScanSessionsStorage,
    private device: Device,
  ) { }

  public isVisible = false;

  ionViewDidEnter() {
    this.ga.trackView("SelectServerPage");
    this.isVisible = true;
    this.scanForServers();

    Promise.join(this.settings.getSavedServers(), this.settings.getDefaultServer(), (savedServers, defaultServer) => {
      this.addServers(savedServers, false, true);
      this.addServer(defaultServer, false, false);
      // this.settings.setDefaultServer(this.selectedServer);            
      this.setSelectedServer(defaultServer);
      console.log("SELSER: default server present in localstorage: " + defaultServer.address + " connecting...")
      // this.connect(defaultServer);
    });
  }

  ionViewDidLeave() {
    this.isVisible = false;
    this.serverProvider.unwatch();
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
    this.barcodeScanner.scan({
      "showFlipCameraButton": true,
    }).subscribe((scan: ScanModel) => {
      if (scan && scan.text) {
        let servers = ServerModel.serversFromJSON(scan.text);
        servers.forEach(server => this.addServer(server, true, true));
        this.setSelectedServer(servers[0]);
      }
    }, err => { });
  }

  onAddManuallyClicked() {
    let alert = this.alertCtrl.create({
      title: 'Add manually',
      inputs: [{
        name: 'name',
        placeholder: 'Name (optional)'
      }, {
        name: 'address',
        placeholder: 'Address (eg: 192.168.0.123)',
      }],
      buttons: [{
        text: 'Cancel',
        role: 'cancel'
      }, {
        text: 'Add',
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
    this.serverProvider.unwatch();
    this.serverProvider.watchForServers().subscribe(data => {
      let server = data.server;
      if (data.action == 'added' || data.action == 'resolved') {
        this.addServer(server, true, false);
      } else {
        // this.setOnline(server, false);
      }
    });

    if (this.cannotFindServerTimeout) clearTimeout(this.cannotFindServerTimeout);
    this.cannotFindServerTimeout = setTimeout(() => {
      let onlineServers = this.servers.find(x => x.online != 'offline');
      if (!onlineServers) {
        let alert = this.alertCtrl.create({
          title: "Cannot find the server",
          message: "Make you sure that the server is running on your computer.<br><br>\
                        If you're still unable to connect do the following:<br>\
                        <ul text-center>\
                          <li>Add Barcode to PC server to Windows Firewall exceptions\
                          <li>Try to temporarily disable your antivirus\
                        </ul>",
          buttons: [{
            text: 'Offline mode',
            role: 'cancel',
            handler: () => { }
          }, {
            text: 'Help',
            handler: () => {
              window.open('mailto:' + Config.EMAIL_SUPPORT, '_system');
            }
          }, {
            text: 'Scan again',
            handler: () => {
              this.servers.forEach(x => x.online = 'offline');
              this.scanForServers();
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
          console.log('[SEL-SER] server ' + addServer.name + ' was added again (announced)')
          if (server.online != 'connected') {
            server.online = 'online';

            if (this.selectedServer && this.selectedServer.equals(server) && this.serverProvider.isReconnecting()) {
              console.log('[SEL-SER] the connection state is != connected, trying to connect to ' + addServer.address + ' immediatly because is the selected server')
              this.connect(this.selectedServer);
            }
          }
        }
        // if (forceNameUpdate) {
        //     server.name = addServer.name;
        // }
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
      if (defaultServer.equals(server)) {
        this.settings.setDefaultServer(null);
      }
    }).catch(() => { })
      .then(() => {
        console.log('after default server resolved or rejected');
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
    console.log('[SEL-SER]setting ' + server.address + ' online = ' + online)
    let s = this.servers.find(x => x.equals(server));
    if (s) {
      s.online = online;
    }
  }

  connect(server: ServerModel) {
    console.log('[SEL-SER]connect(' + server.address + ')');
    // this.serverProvider.onResponse().subscribe((response: responseModel) => {});
    if (this.wsEventsSubscription) {
      this.wsEventsSubscription.unsubscribe();
      this.wsEventsSubscription = null;
      this.servers.forEach(x => {
        if (x.online == 'connected') {
          x.online = 'online';
        }
      })
      // console.log('[SEL-SER]unsubscribed ' + server.address);
    }
    this.wsEventsSubscription = this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
      if (event.ws.url.indexOf(server.address) == -1) return;
      console.log('[SEL-SER] onWsEvent(): name: ' + event.name + ' url: ' + event.ws.url + ' subscriber: ' + server.address);
      if (event.ws.url.indexOf(server.address) != -1) {
        if (event.name == wsEvent.EVENT_OPEN || event.name == wsEvent.EVENT_ALREADY_OPEN) {
          // this.addServer(server, true, false);
          // this.lastConnectedServer = server;
          this.setOnline(server, 'connected');
        } else {
          // console.log('[SEL-SER]connect()->event: ' + event.name + ' setting ' + server.address + ' online= false')
          this.setOnline(server, 'offline')
        }
      }
    });
    this.serverProvider.connect(server, true);
  }

  setSelectedServer(server: ServerModel) {
    let s = this.servers.find(x => x.equals(server));
    if (s) {
      console.log('setSelectedServer(): ' + s.address);
      this.selectedServer = s;
      this.onSelectServerChanged();
    }
  }
}
