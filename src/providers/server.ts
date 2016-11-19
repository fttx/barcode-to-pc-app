import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs'
import 'rxjs/add/operator/map';
import { ServerModel } from '../models/server.model'
import { Settings } from '../providers/settings'
import { Config } from './config'
import { ToastController } from 'ionic-angular';

declare var cordova: any;

/*
  Generated class for the Server provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ServerProvider {
  public static ACTION_PUT_SCANSESSIONS = 'putScanSessions';
  public static ACTION_PUT_SCAN = 'putScan';
  public static ACTION_DELETE_SCAN = 'deleteScan';
  public static ACTION_DELETE_SCANSESSION = 'deleteScanSession';
  
  private webSocket: WebSocket;
  private everConnected = false;

  constructor(
    private settings: Settings,
    private NgZone: NgZone,
    private toastCtrl: ToastController,
  ) { }

  connect(server) {
    let address = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    return Observable.create(observer => {
      this.webSocket = new WebSocket(address);

      this.webSocket.onmessage = message => {
        observer.next(message);
      }

      this.webSocket.onopen = () => {
        this.everConnected = true;
        observer.next();
        this.toastCtrl.create({ message: 'Connection extablished', duration: 3000 }).present();
      };

      this.webSocket.onerror = msg => {
        observer.error(JSON.stringify(msg));
        if (this.everConnected) {
          this.toastCtrl.create({ message: 'Connection failed', duration: 3000 }).present();
        }
      }

      this.webSocket.onclose = () => {
        observer.error("connection lost"); if (this.everConnected) {
          this.toastCtrl.create({ message: 'Connection lost', duration: 3000 }).present();
        }
      }
    });
  }

  saveAsDefault(server: ServerModel) {
    this.settings.setDefaultServer(server);
  }

  getDefaultServer(): Promise<ServerModel> {
    return this.settings.getDefaultServer();
  }

  send(action, data = {}) {
    if (this.webSocket) {
      if (this.webSocket.readyState == WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ 'action': action, 'data': data }));
      } else {
        this.toastCtrl.create({ message: 'Connection problem', duration: 3000 }).present();
      }
    } else {
      console.log("offline mode, cannot send!")
    }
  }

  watchForServers() {
    return Observable.create(observer => {
      if (typeof cordova == typeof undefined) { // for browser support
        observer.next({ address: 'localhost', name: 'localhost' });
        return;
      }
      cordova.plugins.zeroconf.watch('_http._tcp.local.', (result) => {
        var action = result.action;
        var service = result.service;
        if (action == 'added' && service.port == Config.SERVER_PORT && service.addresses && service.addresses.length) {
          this.NgZone.run(() => {
            observer.next({
              address: service.addresses[0],
              name: service.server
            });
          });
        }
      });
    });
  }

  unwatch() {
    if (typeof cordova != typeof undefined) {
      cordova.plugins.zeroconf.unwatch('_http._tcp.local.');
    }
  }
}
