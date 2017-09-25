import { ServerModel } from './../models/server.model';
import { Injectable, NgZone } from '@angular/core';
import { Settings } from '../providers/settings'
import { Config } from './config'
import { ToastController, Platform } from 'ionic-angular';
import { Zeroconf } from '@ionic-native/zeroconf';
import { Subject, Observable } from "rxjs";
import { discoveryResultModel } from "../models/discovery-result";
import { responseModel } from '../models/response.model';
import { requestModel } from '../models/request.model';
import { wsEvent } from '../models/ws-event.model';
/*
  Generated class for the Server provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ServerProvider {
  public static RECONNECT_INTERVAL = 7000;
  public static EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION = 4000; // Another server has been selected, do not attemp to connect again

  private webSocket: WebSocket;
  private responseObserver = new Subject<responseModel>();
  private wsEventObserver = new Subject<wsEvent>();
  private reconnectInterval;
  private reconnecting = false;
  private everConnected = false;
  private serverQueue: ServerModel[] = [];

  constructor(
    private settings: Settings,
    private NgZone: NgZone,
    private toastCtrl: ToastController,
    private zeroconf: Zeroconf,
    public platform: Platform
  ) {
  }


  onResponse(): Subject<responseModel> {
    return this.responseObserver;
  }

  onWsEvent(): Subject<wsEvent> {
    return this.wsEventObserver;
  }

  connect(server: ServerModel) {
    if (!this.webSocket || this.webSocket.readyState != WebSocket.OPEN) {
      console.log('not connected, creating a new WS connection...');
      this.wsConnect(server);
    } else if (this.webSocket.readyState == WebSocket.OPEN) {
      console.log('already connected to a server, no action taken');
      this.wsEventObserver.next({ name: 'open' });
    }
    console.log('queue: ', this.serverQueue);
  }

  disconnect(reconnect = false) {
    if (this.webSocket) {
      let code = reconnect ? 1000 : ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION;
      this.webSocket.close(code);// 1000 = CLOSE_NORMAL
      this.webSocket.removeEventListener('onmessage');
      this.webSocket.removeEventListener('onopen');
      this.webSocket.removeEventListener('onerror');
      this.webSocket.removeEventListener('onclose');
      this.webSocket = null;
      console.log('disconnected(reconnect=' + reconnect + ')');
    }
  }

  private wsConnect(server: ServerModel) {
    console.log('wsConnect(' + server.address + ')', new Date())

    if (this.webSocket && (this.webSocket.readyState == WebSocket.CLOSING || this.webSocket.readyState == WebSocket.CONNECTING)) {
      // If the connection is in one of these two transitioning states the new connection should be queued
      if (!this.serverQueue.find(x => x.equals(server))) {
        this.serverQueue.push(server);
      }
      console.log('WS: the connection is in a transitioning state, the new connection has been queued');
      return;
    }

    if (this.webSocket && this.webSocket.readyState == WebSocket.OPEN) {
      this.serverQueue = []; // if the connection is open the queue is useless and should be emptied
      console.log('WS: the connection is already open, please disconnect before calling wsConnect()')
      return;
    }

    this.disconnect();

    let wsUrl = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    this.webSocket = new WebSocket(wsUrl);
    console.log('WS: A new WebSocket has been created')

    this.webSocket.onmessage = message => {
      let messageData: responseModel = null;
      if (message.data) {
        messageData = JSON.parse(message.data);
      }

      this.responseObserver.next(messageData);
    }

    this.webSocket.onopen = () => {
      console.log('onopen')
      this.everConnected = true; // for current instance
      this.settings.setEverConnected(true); // for statistics usage

      this.serverQueue = [];

      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        this.reconnecting = false;
        console.log("WS: reconnected successfully... interval cleared.")
      }

      this.settings.saveServer(server);
      this.wsEventObserver.next({ name: 'open' });

      this.toastCtrl.create({ message: 'Connection established with ' + server.name, duration: 3000 }).present();
    };

    this.webSocket.onerror = err => {
      console.log('onerror')

      if (!this.reconnecting) {
        this.toastCtrl.create({ message: 'Connection problem', duration: 3000 }).present();
      }

      this.wsEventObserver.next({ name: 'error' });
      this.scheduleNewWsConnection(server);
    }

    this.webSocket.onclose = (ev: CloseEvent) => {
      console.log('onclose')

      if (this.everConnected && !this.reconnecting) {
        this.toastCtrl.create({ message: 'Connection closed', duration: 3000 }).present();
      }
      if (ev.code != ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION) {
        this.scheduleNewWsConnection(server);
      }

      this.wsEventObserver.next({ name: 'close' });
    }
  }

  private scheduleNewWsConnection(server) {
    this.reconnecting = true;
    if (!this.reconnectInterval) {
      if (this.serverQueue.length) {
        console.log('server queue is not empty, attemping a new reconnection whithout waiting')
        server = this.serverQueue.shift(); // Removes the first element from an array and returns it
        this.wsConnect(server);
      } else {
        this.reconnectInterval = setInterval(() => {
          this.wsConnect(server);
        }, ServerProvider.RECONNECT_INTERVAL);
      }

      console.log("reconnection scheduled.")
    }
  }

  send(request: requestModel) {
    if (this.webSocket) {
      if (this.webSocket.readyState == WebSocket.OPEN) {
        console.log(request, JSON.stringify(request));
        this.webSocket.send(JSON.stringify(request));
      } else {
        this.toastCtrl.create({ message: 'Connection problem', duration: 3000 }).present();
      }
    } else {
      // console.log("offline mode, cannot send!")
    }
  }

  watchForServers(): Observable<discoveryResultModel> {
    return Observable.create(observer => {
      if (!this.platform.is('cordova')) { // for browser support
        setTimeout(() => {
          let dummyServer: discoveryResultModel = { server: new ServerModel('localhost', 'localhost'), action: 'added' };
          observer.next(dummyServer);
        }, 1000)
        return;
      }
      this.unwatch();
      this.zeroconf.watch('_http._tcp.', 'local.').subscribe(result => {
        var action = result.action;
        var service = result.service;
        if (service.port == Config.SERVER_PORT && service.ipv4Addresses && service.ipv4Addresses.length) {
          console.log("ZEROCONF:", result);

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
    console.log('UNWATCHED ')
    this.zeroconf.close();
  }

  // isConnectedWith(server: ServerModel) {
  //   if (this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
  //     return false;
  //   }
  //   return true;
  // }
}
