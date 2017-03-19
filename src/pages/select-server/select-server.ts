import { Settings } from '../../providers/settings';
import { Component, NgZone } from '@angular/core';
import { NavController, ViewController, AlertController } from 'ionic-angular';
import { ServerProvider } from '../../providers/server'
import { ServerModel } from '../../models/server.model'
import { GoogleAnalyticsService } from '../../providers/google-analytics'

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

  constructor(
    public navCtrl: NavController,
    public viewCtrl: ViewController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private settings: Settings,
    private googleAnalytics: GoogleAnalyticsService,
    private zone: NgZone
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
      this.selectedServer = defaultServer;
    },
      err => { }
    );
  }

  onServerClicked(server) {
    this.settings.setDefaultServer(server);
    this.serverProvider.connect(server);
    // this.navCtrl.pop();
    this.selectedServer = server;
  }

  addManually() {
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
          let server = new ServerModel(input.address, input.name);
          this.addServer(server, false, true);
          this.settings.setDefaultServer(server);
          this.selectedServer = server;
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
      if (data.action == 'added') {
        console.log("server discovered:  ", server);
        this.addServer(server, true, false);
      } else {
        console.log("server undiscovered:  ", server);
        let previuslyDiscovered = this.servers.find(x => x.equals(server));
        if (previuslyDiscovered) {
          previuslyDiscovered.online = false;
        }
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
                      <li>Add the server to Windows Firewall exceptions\
                      <li>Try to temporarily disable your antivirus\
                    </ul>",
          buttons: [{
            text: 'Offline mode',
            role: 'cancel',
            handler: () => { }
          }, {
            text: 'Help',
            handler: () => {

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
    }, 20 * 1000)
  } // scanForServers


  isSelected(server: ServerModel) {
    if (this.selectedServer) {
      return this.selectedServer.equals(server);
    }
    return false;
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
        this.selectedServer = this.servers[0];
        this.settings.setDefaultServer(this.selectedServer);
      }
    }
  }
}
