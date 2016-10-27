import { Injectable } from '@angular/core';
import { Observable } from 'rxjs'
import 'rxjs/add/operator/map';
import { ServerModel } from '../models/server.model'
import { WebSocketProvider } from '../providers/websocket'
import { Config } from './config'
import { Storage } from '@ionic/storage';
declare var cordova: any;

/*
  Generated class for the Server provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ServerProvider {
  private static SECURE_STORAGE_DEFAULT_SERVER = "default_server";
  private webSocketProvider: WebSocketProvider;

  constructor(public storage: Storage) { }

  connect(server): WebSocketProvider {
    if (this.webSocketProvider) {
      return this.webSocketProvider;
    }
    let address = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    this.webSocketProvider = new WebSocketProvider(address);
    return this.webSocketProvider;
  }

  saveAsDefault(server: ServerModel) {
    this.storage.set(ServerProvider.SECURE_STORAGE_DEFAULT_SERVER, JSON.stringify(server));
  }

  getDefaultServer(): Promise<ServerModel> {
    return new Promise((resolve, reject) => {
      this.storage.get(ServerProvider.SECURE_STORAGE_DEFAULT_SERVER).then((data) => {
        if (data != null) {
          resolve(JSON.parse(data))          
        } else {
          reject();
        }
      });
    });
  }

  send(object) {
    return this.webSocketProvider.send(object);
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
