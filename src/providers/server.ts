import { ServerModel } from './../models/server.model';
import { Injectable, NgZone } from '@angular/core';
import { Settings } from '../providers/settings'
import { Config } from './config'
import { ToastController, Platform, AlertController } from 'ionic-angular';
import { Zeroconf } from '@ionic-native/zeroconf';
import { Subject, Observable } from "rxjs";
import { discoveryResultModel } from "../models/discovery-result";
import { responseModel, responseModelPopup } from '../models/response.model';
import { requestModel, requestModelPing, requestModelPutScanSessions, requestModelHelo } from '../models/request.model';
import { wsEvent } from '../models/ws-event.model';
import { ScanSessionsStorage } from './scan-sessions-storage';
import * as Promise from 'bluebird'
import { Device } from '@ionic-native/device';

/*
  Generated class for the Server provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ServerProvider {
  public static RECONNECT_INTERVAL = 7000;
  public static EVENT_CODE_CLOSE_NORMAL = 1000;
  public static EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION = 4000; // Another server has been selected, do not attemp to connect again

  private webSocket: WebSocket;
  private responseObserver = new Subject<responseModel>();
  private wsEventObserver = new Subject<wsEvent>();
  public reconnecting = false;
  private everConnected = false;
  private serverQueue: ServerModel[] = [];

  private reconnectInterval = null;
  private heartBeatInterval = null;
  private pongTimeout = null;

  private paused = false;
  private lastToastMessage: string;

  constructor(
    private settings: Settings,
    private NgZone: NgZone,
    private toastCtrl: ToastController,
    private zeroconf: Zeroconf,
    private alertCtrl: AlertController,
    public platform: Platform,
    public device: Device,
    private scanSessionsStorage: ScanSessionsStorage,
  ) {
    platform.pause.subscribe(() => {
      this.paused = true;
      //console.log('[S]: paused')
    });

    platform.resume.subscribe(() => {
      this.paused = false;
      if (this.lastToastMessage && this.lastToastMessage.length) {
        this.toast(this.lastToastMessage);
      }
      //console.log('[S]: resumed')
    });
  }


  onResponse(): Subject<any> {
    return this.responseObserver;
  }

  onWsEvent(): Subject<wsEvent> {
    return this.wsEventObserver;
  }

  connect(server: ServerModel, skipQueue: boolean = false) {
    if (!this.webSocket || this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
      console.log('[S]: not connected or new server selected, creating a new WS connection...');
      this.wsConnect(server, skipQueue);
    } else if (this.webSocket.readyState == WebSocket.OPEN) {
      console.log('[S]: already connected to a server, no action taken');
      this.serverQueue = [];
      this.wsEventObserver.next({ name: 'alreadyOpen', ws: this.webSocket });
    }
    //console.log('[S]: queue: ', this.serverQueue);
  }

  disconnect() {
    this.wsDisconnect(false);
  }

  private wsDisconnect(reconnect = false) {
    console.log('[S]: wsDisconnect(reconnect=' + reconnect + ')', this.webSocket);

    if (this.webSocket) {
      if (this.everConnected && !this.reconnecting) {
        this.toast('Connection lost');
        this.wsEventObserver.next({ name: 'error', ws: this.webSocket });
      }
      let code = reconnect ? ServerProvider.EVENT_CODE_CLOSE_NORMAL : ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION;
      this.webSocket.close(code);
      this.webSocket.onmessage = null;
      this.webSocket.onopen = null;
      this.webSocket.onerror = null;
      this.webSocket.onclose = null;
      this.webSocket = null;
    }
  }

  private isTransitioningState() {
    return this.webSocket && (this.webSocket.readyState == WebSocket.CLOSING || this.webSocket.readyState == WebSocket.CONNECTING);
  }

  private wsConnect(server: ServerModel, skipQueue: boolean = false) {
    //console.log('[S]: wsConnect(' + server.address + ')', new Date())

    if (skipQueue) {
      console.log('[S]: WS: skipQueue is true, skipping the queue and disconnecting from the old one')
      this.serverQueue = [];
      this.serverQueue.push(server);
      this.reconnecting = true;
    } else if (this.isTransitioningState()) {
      //console.log('[S]: WS: the connection is in a transitioning state');
      // If the connection is in one of these two transitioning states the new connection should be queued
      if (!this.serverQueue.find(x => x.equals(server))) {
        this.serverQueue.push(server);
        //console.log('[S]: WS: the server has been added to the connections list')
      } else {
        //console.log('[S]: WS: the server is already in the connections queue');
      }

      setTimeout(() => {
        if (this.isTransitioningState()/* && this.webSocket.url.indexOf(server.address) != -1*/) {
          //console.log('[S]: the server ' + server.address + ' is still in transitiong state after 5 secs of connect(), closing the connection...')
          this.wsDisconnect();
          this.webSocket = null;
        }
      }, 5000);
      return;
    }

    this.wsDisconnect();

    let wsUrl = 'ws://' + server.address + ':' + Config.SERVER_PORT + '/';
    this.webSocket = new WebSocket(wsUrl);
    //console.log('[S]: WS: A new WebSocket has been created')

    this.webSocket.onmessage = message => {
      //console.log('[S]: this.webSocket.onmessage()', message)

      let messageData: responseModel = null;
      if (message.data) {
        messageData = JSON.parse(message.data);
      }

      if (messageData.action == responseModel.ACTION_REQUEST_SYNC) {
        Promise.join(this.scanSessionsStorage.getLastScanDate(), this.scanSessionsStorage.getScanSessions(), (lastScanDate, scanSessions) => {
          let wsRequest = new requestModelPutScanSessions().fromObject({
            scanSessions: scanSessions,
            sendKeystrokes: false,
            lastScanDate: lastScanDate,
            deviceId: this.device.uuid,
          });
          this.send(wsRequest);
        })
      }

      if (messageData.action == responseModel.ACTION_PONG) {
        //console.log('[S]: WS: pong received, stop waiting 5 secs')
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
      } else if (messageData.action == responseModel.ACTION_POPUP) {
        let responseModelPopup: responseModelPopup = message.data;
        this.alertCtrl.create({
          title: responseModelPopup.title,
          message: responseModelPopup.message,
          buttons: ['Ok']
        }).present();
      } else {
        this.responseObserver.next(messageData);
      }
    }

    this.webSocket.onopen = () => {
      //console.log('[S]: onopen')
      this.everConnected = true; // for current instance
      this.settings.setEverConnected(true); // for statistics usage
      this.serverQueue = [];

      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
        this.reconnecting = false;
        console.log("WS: reconnected successfully... interval cleared.")
      }

      this.settings.saveServer(server);
      this.wsEventObserver.next({ name: 'open', ws: this.webSocket });
      this.toast('Connection established with ' + server.name)

      //console.log('[S]: WS: new heartbeat started');
      if (this.heartBeatInterval) clearInterval(this.heartBeatInterval);
      this.heartBeatInterval = setInterval(() => {
        //console.log('[S]: WS: sending ping')
        let request = new requestModelPing();
        this.send(request);
        //console.log('[S]: WS: waiting 5 secs before starting the connection again')
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
        this.pongTimeout = setTimeout(() => { // do 5 secondi per rispondere
          console.log('[S]: WS pong not received, closing connection...')
          this.wsDisconnect(false);
          this.scheduleNewWsConnection(server); // se il timeout non è stato fermato prima da una risposta, allora schedulo una nuova connessione
        }, 1000 * 5);
      }, 1000 * 60); // ogni 60 secondi invio ping


      Promise.join(this.settings.getRated(), this.settings.getDeviceName(), this.scanSessionsStorage.getLastScanDate(), (rated, deviceName, lastScanDate) => {
        console.log('promise join: getNoRunnings getRated getDeviceName ')
        let request = new requestModelHelo().fromObject({
          deviceName: deviceName,
          deviceId: this.device.uuid,
          lastScanDate: lastScanDate,
        });
        this.send(request);
      });
    };

    this.webSocket.onerror = err => {
      //console.log('[S]: onerror')

      if (!this.reconnecting) {
        this.toast('Unable to connect. Select Help from the app menu in order to determine the cause');
      }

      this.wsEventObserver.next({ name: 'error', ws: this.webSocket });
      this.scheduleNewWsConnection(server);
    }

    this.webSocket.onclose = (ev: CloseEvent) => {
      //console.log('[S]: onclose')

      if (this.everConnected && !this.reconnecting) {
        this.toast('Connection closed');
      }
      if (ev.code != ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION) {
        this.scheduleNewWsConnection(server);
      }

      this.wsEventObserver.next({ name: 'close', ws: this.webSocket });
    }
  }

  private scheduleNewWsConnection(server) {
    console.log('[S]: scheduleNewWsConnection()->')
    this.reconnecting = true;
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    if (this.heartBeatInterval) clearInterval(this.heartBeatInterval);
    if (!this.reconnectInterval) {
      if (this.serverQueue.length) {
        console.log('[S]:    server queue is not empty, attemping a new reconnection whithout waiting')
        server = this.serverQueue.shift(); // Removes the first element from an array and returns it
        this.wsConnect(server);
      } else {
        console.log('[S]:    server queue is empty, attemping a new reconnection to the same server in ' + ServerProvider.RECONNECT_INTERVAL + ' secs');
        this.reconnectInterval = setInterval(() => {
          this.wsConnect(server);
        }, ServerProvider.RECONNECT_INTERVAL);
      }

      //console.log("   reconnection scheduled.")
    }
  }

  send(request: requestModel) {
    if (this.webSocket) {
      if (this.webSocket.readyState == WebSocket.OPEN) {
        //console.log(request, JSON.stringify(request));
        this.webSocket.send(JSON.stringify(request));
      } else {
        this.toast('Connection problem');
      }
    } else {
      // //console.log("offline mode, cannot send!")
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
          //console.log("ZEROCONF:", result);

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
    //console.log('[S]: UNWATCHED ')
    this.zeroconf.close();
  }

  // isConnectedWith(server: ServerModel) {
  //   if (this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
  //     return false;
  //   }
  //   return true;
  // }

  private toast(message: string) {
    if (!this.paused) {
      this.lastToastMessage = message;
      this.toastCtrl.create({ message: message, duration: 3000 }).present();
      this.lastToastMessage = null;
    }
  }
}
