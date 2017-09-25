import { ServerModel } from './../../models/server.model';
import { Settings } from '../../providers/settings';
import { Component } from '@angular/core';
import { NavController, ViewController, AlertController } from 'ionic-angular';
import { ServerProvider } from '../../providers/server'
import { Config } from '../../providers/config'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { BarcodeScanner } from '@ionic-native/barcode-scanner';
import { ScanModel } from "../../models/scan.model";
import { responseModel } from '../../models/response.model';
import { wsEvent } from '../../models/ws-event.model';

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
  public selectedServer: ServerModel;
  public servers: ServerModel[] = [];
  private lastConnectedServer: ServerModel;

  constructor(
    public navCtrl: NavController,
    public viewCtrl: ViewController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private settings: Settings,
    private googleAnalytics: GoogleAnalyticsService,
    private barcodeScanner: BarcodeScanner,
  ) { }

  public isVisible = false;

  ionViewDidEnter() {
    this.googleAnalytics.trackView("SelectServerPage");
    this.isVisible = true;
  }

  ionViewDidLeave() {
    this.isVisible = false;
  }

  ionViewDidLoad() {
    this.viewCtrl.willLeave.subscribe(() => {
      this.serverProvider.unwatch();
    })

    this.scanForServers();

    this.settings.getSavedServers().then((servers: ServerModel[]) => {
      this.addServers(servers, false, true);
    },
      err => { }
    );

    this.settings.getDefaultServer().then((defaultServer: ServerModel) => {
      this.setSelectedServer(defaultServer);
      console.log("SELSER: default server present in localstorage: ", defaultServer, " connecting...")
      this.connect(defaultServer);
    },
      err => { }
    );
  }

  onSelectServerChanged() {
    console.log("SELSER: onSelectServerChanged() -> ", this.selectedServer);
    if (this.selectedServer) {
      if (!this.lastConnectedServer || !this.lastConnectedServer.equals(this.selectedServer)) {
        console.log('SELSER: selected server: ', this.selectedServer, ' disconnecting from the old one...', this.lastConnectedServer);
        if (this.lastConnectedServer) {
          this.serverProvider.disconnect();
        }
        this.connect(this.selectedServer);
      }
      // this.navCtrl.pop();
    }
  }

  onScanQRCodeClicked() {
    this.barcodeScanner.scan({
      "showFlipCameraButton": true,
    }).then((scan: ScanModel) => {
      if (scan && scan.text) {
        let servers = ServerModel.serversFromJSON(scan.text);
        servers.forEach(server => this.addServer(server, true, false));
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
          this.settings.setDefaultServer(server);
          this.setSelectedServer(server);
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
        this.setOnline(server, false);
      }
    });

    setTimeout(() => {
      let onlineServers = this.servers.find(x => x.online);
      if (!onlineServers && this.isVisible) {
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
              this.servers.forEach(x => x.online = false);
              this.scanForServers();
            }
          }]
        });
        alert.present();
      }
    }, Config.SHOW_CANNOT_FIND_DIALOG_TIMEOUT)
  } // scanForServers


  isSelected(server: ServerModel) {
    return this.selectedServer.equals(server);
  }

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
          server.online = true;
        }
        if (forceNameUpdate) {
          server.name = addServer.name;
        }
      }
    });

    if (!found) {
      if (forceOnline) {
        addServer.online = true;
      }
      this.servers.push(addServer);
    }
  }

  deleteServer(server) {
    this.settings.deleteServer(server);
    this.servers.splice(this.servers.indexOf(server), 1);

    if (this.selectedServer && this.selectedServer.equals(server)) {
      if (this.servers.length) {
        this.setSelectedServer(this.servers[0]);
        this.settings.setDefaultServer(this.selectedServer);
      }
    }
  }

  /**
   * It works only if the server is present in the list,
   * if you want to override the online status and 
   * you're not sure if the server is present use addServer() 
   * to override the online status
   * @param server 
   * @param online 
   */
  setOnline(server: ServerModel, online: boolean) {
    let previuslyDiscovered = this.servers.find(x => x.equals(server));
    if (previuslyDiscovered) {
      previuslyDiscovered.online = online;
    }
  }

  connect(server: ServerModel) {
    // this.serverProvider.onResponse().subscribe((response: responseModel) => {

    // });

    this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
      if (event.name == wsEvent.EVENT_OPEN) {
        this.settings.setDefaultServer(server);
        this.addServer(server, true, false);
        this.lastConnectedServer = server;
      } else {
        this.setOnline(server, false)
      }
    });

    this.serverProvider.connect(server);
  }

  setSelectedServer(server: ServerModel) {
    let s = this.servers.find(x => x.equals(server));
    if (s) {
      this.selectedServer = s;
    }
  }
}
