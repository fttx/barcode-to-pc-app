import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs'
import { ServerModel } from '../models/server.model'
import { Settings } from '../providers/settings'
import { Config } from './config'
import { ToastController, Platform } from 'ionic-angular';
import { Zeroconf } from '@ionic-native/zeroconf';
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
  public static ACTION_GET_VERSION = 'getVersion';
  public static RECONNECT_INTERVAL = 7000;
  public static EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION = 4000; // Another server has been selected, do not attemp to connect again

  private webSocket: WebSocket;
  private observer;
  private reconnectInterval;
  private reconnecting = false;
  private everConnected = false;

  constructor(
    private settings: Settings,
    private NgZone: NgZone,
    private toastCtrl: ToastController,
    private zeroconf: Zeroconf,
    public platform: Platform
  ) { }

  connect(server: ServerModel): Observable<any> {
    return Observable.create(observer => { // ONLY THE LAST SUBSCRIBER WILL RECEIVE UPDATES!!
      this.observer = observer;
      if (!this.webSocket || this.webSocket.readyState != WebSocket.OPEN) {
        this.wsConnect(server);
        console.log('not connected, starting a new WS connection...');
      } else if (this.webSocket.readyState == WebSocket.OPEN) {
        this.observer.next({ wsAction: 'open' });
        console.log('already connected to a server, no action taken');
      }
    });
  }

  disconnect(code = 1000) { // 1000 = CLOSE_NORMAL
    if (this.webSocket) {
      this.webSocket.close(code);
      this.webSocket.removeEventListener('onmessage');
      this.webSocket.removeEventListener('onopen');
      this.webSocket.removeEventListener('onerror');
      this.webSocket.removeEventListener('onclose');
      this.webSocket = null;
      console.log('disconnected')
    }
  }

  private wsConnect(server: ServerModel) {
    console.log('wsConnect()')

    this.disconnect();

    let wsUrl = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    this.webSocket = new WebSocket(wsUrl);

    this.webSocket.onmessage = message => {
      let messageData = null;
      if (message.data) {
        messageData = JSON.parse(message.data);
      }
      this.observer.next({ wsAction: 'message', message: messageData });
    }

    this.webSocket.onopen = () => {
      this.everConnected = true;
      this.observer.next({ wsAction: 'open' });
      this.settings.saveServer(server);

      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        this.reconnecting = false;
        console.log("reconnected successfully... interval cleared.")
      }

      this.toastCtrl.create({ message: 'Connection established with ' + server.name, duration: 3000 }).present();
    };

    this.webSocket.onerror = err => {
      this.observer.next({ wsAction: 'error', err: err });
      if (!this.reconnecting) {
        this.toastCtrl.create({ message: 'Connection problem', duration: 3000 }).present();
      }
      this.scheduleNewWsConnection(server);
    }

    this.webSocket.onclose = (ev: CloseEvent) => {
      this.observer.next({ wsAction: 'close' });
      if (this.everConnected && !this.reconnecting) {
        this.toastCtrl.create({ message: 'Connection closed', duration: 3000 }).present();
      }
      if (ev.code != ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION) {
        this.scheduleNewWsConnection(server);
      }
    }
  }

  private scheduleNewWsConnection(server) {
    this.reconnecting = true;
    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => this.wsConnect(server), ServerProvider.RECONNECT_INTERVAL);
      console.log("reconnection scheduled.")
    }
  }

  send(action, data = {}) {
    if (this.webSocket) {
      if (this.webSocket.readyState == WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ 'action': action, 'data': data }));
      } else {
        this.toastCtrl.create({ message: 'Connection problem', duration: 3000 }).present();
      }
    } else {
      // console.log("offline mode, cannot send!")
    }
  }

  watchForServers(): Observable<any> {
    return Observable.create(observer => {
      if (this.platform.is('core')) { // for browser support
        observer.next({ server: { address: 'localhost', name: 'localhost' }, action: 'added' });
        return;
      }
      this.unwatch();
      this.zeroconf.watch('_http._tcp.', 'local.').subscribe(result => {
        var action = result.action;
        var service = result.service;
        // console.log("ACTION:", action, service);
        if (service.port == Config.SERVER_PORT && service.ipv4Addresses && service.ipv4Addresses.length) {
          this.NgZone.run(() => {
            service.ipv4Addresses.forEach(ipv4 => {
              if (ipv4) {
                observer.next({ server: new ServerModel(ipv4, service.hostname), action: action });
              }
            })
          });
        }
      });
    });
  }

  unwatch() {
    this.zeroconf.close();
  }

  // isConnectedWith(server: ServerModel) {
  //   if (this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
  //     return false;
  //   }
  //   return true;
  // }
}
