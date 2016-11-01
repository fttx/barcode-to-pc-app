import { Injectable } from '@angular/core';
import { Observable } from 'rxjs'
import 'rxjs/add/operator/map';
import { ServerModel } from '../models/server.model'
import { Settings } from '../providers/settings'
import { Config } from './config'
declare var cordova: any;

/*
  Generated class for the Server provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ServerProvider {
  private webSocket: WebSocket;
  public observable: Observable<Event>;

  constructor(private settings: Settings) { }

  connect(server) {
    let address = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    this.observable = Observable.create(observer => {
      this.webSocket = new WebSocket(address);

      this.webSocket.onmessage = (message) => observer.next(message);
      this.webSocket.onopen = () => { observer.next() };
      this.webSocket.onerror = (msg) => Observable.throw(new Error(JSON.stringify(msg)))
    });
  }

  saveAsDefault(server: ServerModel) {
    this.settings.setDefaultServer(server);
  }

  getDefaultServer(): Promise<ServerModel> {
    return this.settings.getDefaultServer();
  }

  send(object) {
    if (this.webSocket) {
      this.webSocket.send(JSON.stringify(object));
    } else {
      console.log("offline mode, cannot send!")
    }
  }

  watchForServers() { // TODO: restituire promise invece di observable perchè richiede NgZone ora come ora
    return Observable.create(observer => {
      if (typeof cordova == typeof undefined) { // for browser support
        observer.next({ address: 'localhost', name: 'localhost' });
        return;
      }

      cordova.plugins.zeroconf.watch('_http._tcp.local.', (result) => {
        var action = result.action;
        var service = result.service;
        if (action == 'added' && service.port == Config.SERVER_PORT && service.addresses && service.addresses.length) {
          observer.next({
            address: service.addresses[0],
            name: service.server
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
