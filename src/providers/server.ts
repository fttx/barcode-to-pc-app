import { Injectable, NgZone } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { Device } from '@ionic-native/device';
import { NetworkInterface } from '@ionic-native/network-interface';
import { Zeroconf } from '@ionic-native/zeroconf';
import { Alert, AlertController, Events, Platform } from 'ionic-angular';
import * as ipUtils from 'ip-utils';
import { Observable, Subject } from 'rxjs';
import { SemVer } from 'semver';
import { discoveryResultModel } from '../models/discovery-result';
import { requestModel, requestModelDeleteScanSessions, requestModelGetVersion, requestModelHelo, requestModelPing, requestModelPutScanSessions } from '../models/request.model';
import { responseModel, responseModelEnableQuantity, responseModelHelo, responseModelKick, responseModelPopup, responseModelUpdateSettings } from '../models/response.model';
import { wsEvent } from '../models/ws-event.model';
import { HelpPage } from '../pages/help/help';
import { Settings } from '../providers/settings';
import { ServerModel } from './../models/server.model';
import { Config } from './config';
import { LastToastProvider } from './last-toast/last-toast';
import { ScanSessionsStorage } from './scan-sessions-storage';
// Warning: do not import ScanProvider to prevent circular dependency
// To communicate with ScanProvider use global events.

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

  public serverVersion: SemVer = null;

  private connected = false;
  private webSocket: WebSocket;
  private _onMessage = new Subject<responseModel>();
  private _onConnect = new Subject<ServerModel>();
  private _onDisconnect = new Subject<any>();
  private wsEventObservable = new Subject<wsEvent>();
  private watchForServersSubject: Subject<discoveryResultModel>;
  private reconnecting = false;
  private everConnected = false; // in the current session
  private connectionProblemAlert = false; // in the current session
  private serverQueue: ServerModel[] = [];

  private reconnectInterval = null;
  private heartBeatInterval = null;
  private pongTimeout = null;

  private fallBackTimeout = null;
  private popup: Alert = null;
  private kickedOut = false;

  private lastOnResumeSubscription = null;

  constructor(
    private settings: Settings,
    private ngZone: NgZone,
    private lastToast: LastToastProvider,
    private zeroconf: Zeroconf,
    private alertCtrl: AlertController,
    public platform: Platform,
    public device: Device,
    private networkInterface: NetworkInterface,
    public events: Events,
    private appVersion: AppVersion,
    private scanSessionsStorage: ScanSessionsStorage,
  ) {
  }

  onMessage(): Observable<any> {
    return this._onMessage.asObservable();
  }

  onWsEvent(): Subject<wsEvent> {
    return this.wsEventObservable;
  }

  onConnect(): Observable<ServerModel> {
    return this._onConnect.asObservable();
  }

  onDisconnect(): Observable<any> {
    return this._onDisconnect.asObservable();
  }

  connect(server: ServerModel, skipQueue: boolean = false) {
    console.log('[S-c] connect(server=', server, 'skipQueue=', skipQueue);
    if (!this.webSocket || this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
      console.log('[S-c]: not connected or new server selected, creating a new WS connection...');
      this.wsConnect(server, skipQueue);
    } else if (this.webSocket.readyState == WebSocket.OPEN) {
      console.log('[S-c]: already connected to a server, no action taken');
      this.serverQueue = [];
      this.connected = true;
      this.wsEventObservable.next({ name: wsEvent.EVENT_ALREADY_OPEN, ws: this.webSocket });
    }
    //console.log('[S]: queue: ', this.serverQueue);
  }

  disconnect() {
    if (this.heartBeatInterval) clearTimeout(this.heartBeatInterval);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    this.wsDisconnect(false);
  }

  isConnected() {
    return this.connected;
  }

  isReconnecting() {
    return this.reconnecting;
  }

  private wsDisconnect(reconnect = false) {
    console.log('[S-wd]: wsDisconnect(reconnect=' + reconnect + ')', this.webSocket);

    if (this.webSocket) {
      // Show 'connection lost' only if we aren't trying to connect to other
      // servers.
      // Also emit the _onDisconnect event to prevent triggering another
      // watchForServers from the scanSesison Page subscription.
      if (this.everConnected && !this.reconnecting) {
        this.lastToast.present('Connection lost');
        this.connected = false;
        this.wsEventObservable.next({ name: wsEvent.EVENT_ERROR, ws: this.webSocket });
        this._onDisconnect.next();
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
    console.log('[S-wc]: wsConnect(' + server.address + ')', new Date())

    if (skipQueue) {
      console.log('[S-wc]: WS: skipQueue is true, skipping the queue and disconnecting from the old one')
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

    this.webSocket.onmessage = async message => {
      //console.log('[S]: this.webSocket.onmessage()', message)

      let messageData = null;
      if (message.data) {
        messageData = JSON.parse(message.data);
      }

      console.log('responseModel action = ', messageData.action)
      if (messageData.action == responseModel.ACTION_HELO) {
        // fallBack for old server versions
        // console.log('FallBack: new HELO request received, aborting fallback')
        if (this.fallBackTimeout) clearTimeout(this.fallBackTimeout);
        // fallBack for old server versions

        // Given a version number MAJOR.MINOR.PATCH, increment the:
        // MAJOR version when you make incompatible API changes,
        // MINOR version when you add functionality in a backwards-compatible manner
        // PATCH version when you make backwards-compatible bug fixes.
        // See: https://semver.org/
        let heloResponse: responseModelHelo = messageData;

        this.appVersion.getVersionNumber().then(appVersionString => {
          let appVersion = new SemVer(appVersionString);
          let serverVersion = new SemVer(heloResponse.version);
          this.serverVersion = serverVersion;
          if (appVersion.major != serverVersion.major) {
            this.showVersionMismatch();
          }
        });

        if (heloResponse.outputProfiles) {
          this.settings.setOutputProfiles(heloResponse.outputProfiles);
        } else {
          // deprecated
          this.settings.setQuantityEnabled(heloResponse.quantityEnabled);
        }

        // Send the request to delete the pending scan sessions already deleted from the app
        let deletedIds = await this.settings.getUnsyncedDeletedScanSesions(heloResponse.serverUUID);
        if (deletedIds) {
          let wsDeleteRequest = new requestModelDeleteScanSessions().fromObject({
            scanSessionIds: deletedIds
          });
          this.send(wsDeleteRequest);
          this.settings.setUnsyncedDeletedScanSesions(heloResponse.serverUUID, []); // Clear the list
        }

        // Send the request to restore the pending scan sessions already restored from the app
        let restoredIds = await this.settings.getUnsyncedRestoredScanSesions();
        if (restoredIds) {
          let wsRestoreRequest = new requestModelPutScanSessions().fromObject({
            scanSessions: (await this.scanSessionsStorage.getScanSessions()).filter(x => restoredIds.indexOf(x.id) != -1),
            sendKeystrokes: false,
            deviceId: this.device.uuid,
          });
          this.send(wsRestoreRequest);
          this.settings.setUnsyncedRestoredScanSesions([]); // Clear the list
        }
      } else if (messageData.action == responseModel.ACTION_PONG) {
        //console.log('[S]: WS: pong received, stop waiting 5 secs')
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
      } else if (messageData.action == responseModel.ACTION_POPUP) {
        let responseModelPopup: responseModelPopup = messageData;
        if (this.popup) {
          this.popup.dismiss();
        }
        this.popup = this.alertCtrl.create({
          title: responseModelPopup.title,
          message: responseModelPopup.message,
          buttons: ['Ok']
        });
        this.popup.present();
      } else if (messageData.action == responseModel.ACTION_UPDATE_SETTINGS) {
        let responseModelUpdateSettings: responseModelUpdateSettings = messageData;
        await this.settings.setOutputProfiles(responseModelUpdateSettings.outputProfiles);
        this.events.publish(responseModel.ACTION_UPDATE_SETTINGS, responseModelUpdateSettings);
      } else if (messageData.action == responseModel.ACTION_GET_VERSION) {
        // fallBack for old server versions
        console.log('FallBack: old getVersion received, showing version mismatch');
        this.showVersionMismatch();
        // fallBack for old server versions
      } else if (messageData.action == responseModel.ACTION_ENABLE_QUANTITY) {
        // deprecated
        let responseModelEnableQuantity: responseModelEnableQuantity = messageData;
        this.settings.setQuantityEnabled(responseModelEnableQuantity.enable);
        // deprecated
      } else if (messageData.action == responseModel.ACTION_KICK) {
        let responseModelKick: responseModelKick = messageData;
        this.kickedOut = true;

        if (responseModelKick.message != '') {
          this.alertCtrl.create({
            title: 'Limit raeched', message: responseModelKick.message,
            buttons: [{ text: 'Close', role: 'cancel' }]
          }).present();
        }
      }
      this.ngZone.run(() => {
        this._onMessage.next(messageData);
      })
    }

    this.webSocket.onopen = () => {
      //console.log('[S]: onopen')
      this.connectionProblemAlert = false;
      this.everConnected = true; // for current instance
      this.settings.setEverConnected(true); // for statistics usage
      this.serverQueue = [];

      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      console.log("[S-wc]: WS: reconnected successfully with " + server.address)
      this.clearReconnectInterval();


      this.settings.saveServer(server);
      this.connected = true;
      this.wsEventObservable.next({ name: 'open', ws: this.webSocket });
      this._onConnect.next(server);
      this.lastToast.present('Connection established with ' + server.name)

      //console.log('[S]: WS: new heartbeat started');
      if (this.heartBeatInterval) clearInterval(this.heartBeatInterval);
      this.heartBeatInterval = setInterval(() => {
        //console.log('[S]: WS: sending ping')
        let request = new requestModelPing();
        this.send(request);
        //console.log('[S]: WS: waiting 5 secs before starting the connection again')
        if (this.pongTimeout) clearTimeout(this.pongTimeout);
        this.pongTimeout = setTimeout(() => { // do 5 secondi per rispondere
          console.log('[S-wc]: WS pong not received, closing connection...')
          this.wsDisconnect(false);
          this.scheduleNewWsConnection(server); // se il timeout non è stato fermato prima da una risposta, allora schedulo una nuova connessione
        }, 1000 * 5);
      }, 1000 * 60); // ogni 60 secondi invio ping


      /** Since we are inside onopen it means that we're connected to a server
       * and we can try to reconnect to it up until another onopen event will
       * occour.
       * When the next onopen will occour it'll use a new 'server' variable, and
       * it'll try to reconnect to it on every resume event */
      if (this.lastOnResumeSubscription != null) {
        this.lastOnResumeSubscription.unsubscribe();
        this.lastOnResumeSubscription = null;
      }
      this.lastOnResumeSubscription = this.platform.resume.subscribe(next => {
        console.log('resume()')
        if (!this.connected) {
          console.log('onResume: not connected -> scheduling new connection immediately')
          this.scheduleNewWsConnection(server);
        }
      });


      this.settings.getDeviceName().then(async deviceName => {
        console.log('[S-wc] sending HELO to ' + server.address)
        let request = new requestModelHelo().fromObject({
          version: await this.appVersion.getVersionNumber(),
          deviceName: deviceName,
          deviceId: this.device.uuid,
        });
        this.send(request);

        // fallBack for old server versions
        // console.log('FallBack: new Helo sent, waiting for response...')
        if (this.fallBackTimeout) clearTimeout(this.fallBackTimeout);
        this.fallBackTimeout = setTimeout(() => {
          // console.log('FallBack: new Helo response not received, sending old getVersion');
          let request = new requestModelGetVersion().fromObject({});
          this.send(request);
        }, 5000);
        // fallBack for old server versions

      });
    };

    this.webSocket.onerror = err => {
      console.log('[S]: WS: onerror ')

      if (!this.reconnecting) {
        this.lastToast.present('Unable to connect. Select Help from the app menu in order to determine the cause');
      }
      this.connected = false;
      this.wsEventObservable.next({ name: wsEvent.EVENT_ERROR, ws: this.webSocket });
      this._onDisconnect.next();
      this.scheduleNewWsConnection(server);
    }

    this.webSocket.onclose = (ev: CloseEvent) => {
      console.log('[S]: onclose')

      if (this.everConnected && !this.reconnecting) {
        this.lastToast.present('Connection closed');
      }
      if (ev.code != ServerProvider.EVENT_CODE_DO_NOT_ATTEMP_RECCONECTION) {
        this.scheduleNewWsConnection(server);
      }

      this.connected = false;
      this.kickedOut = false;
      this.wsEventObservable.next({ name: wsEvent.EVENT_CLOSE, ws: this.webSocket });
      this._onDisconnect.next();
    }
  } // wsConnect() end

  send(request: requestModel) {
    if (this.kickedOut) {
      return;
    }

    if (this.webSocket) {
      if (this.webSocket.readyState == WebSocket.OPEN) {
        //console.log(request, JSON.stringify(request));
        this.webSocket.send(JSON.stringify(request));
      } else if (!this.connectionProblemAlert) {
        this.connectionProblemAlert = true;
        this.alertCtrl.create({
          title: 'Connection problem', message: 'To determine the cause check the help page',
          buttons: [{ text: 'Close', role: 'cancel' }, {
            text: 'Help page', handler: () => {
              this.events.publish('setPage', HelpPage);
            }
          }]
        }).present();
      }
    } else {
      // //console.log("offline mode, cannot send!")
    }
  }

  /**
   * Call stopWatchForServers when you don't need to receive updates anymore
   *
   * It is NOT required to call stopWatchForServers() before calling
   * watchForServers. It'll always start a brand new "watch" everytime it's
   * called.
   */
  watchForServers(): Observable<discoveryResultModel> {
    this.stopWatchForServers();
    console.log("[S] watchForServers()")
    this.watchForServersSubject = new Subject<discoveryResultModel>();

    // Dummy server for debugging
    if (!this.platform.is('cordova')) {
      let dummyServer: discoveryResultModel = { server: new ServerModel('192.168.5.10', 'Server 1'), action: 'added' };
      this.watchForServersSubject.next(dummyServer);
      setTimeout(() => {
        dummyServer = { server: new ServerModel('192.168.6.7', 'Server 2'), action: 'added' };
        this.watchForServersSubject.next(dummyServer);
      }, 500)
      return;
    }

    Promise.all([this.zeroconf.reInit(), this.networkInterface.getWiFiIPAddress(), this.networkInterface.getCarrierIPAddress()].map(p => p.catch(e => { }))).then((results: any[]) => { // ignore rejected promises
      let wifi = results[1];
      let otherInterfaces = results[2];

      // Collect all the interface information inside an array
      let interfaces = []; // [{ip: 192.168.0.1, subnet: 255.255.255.0}, ...]
      if (wifi) interfaces.push(wifi);
      if (otherInterfaces) interfaces.push(otherInterfaces);

      this.zeroconf.watch('_http._tcp.', 'local.').subscribe(zeroconfResult => {
        var action = zeroconfResult.action;
        var service = zeroconfResult.service;
        if (service.port == Config.SERVER_PORT && service.ipv4Addresses && service.ipv4Addresses.length) {
          console.log("[S-wfs] zeroconf ->", zeroconfResult);

          this.ngZone.run(() => {
            service.ipv4Addresses.forEach(ipv4 => {
              if (ipv4 && ipv4.length) {
                // Check if the discovered IP is inside one of the subnets.
                //
                // All the network information can be calculated from the smartphone IP address
                // and the relative subnet mask. We calculate them for each interface of the
                // smartphone and check if the discovered IP address is part of one of the networks.
                let isInSubnets = interfaces.map(x => {
                  return ipUtils.subnet(x.ip + '/' + ipUtils.maskToCidr(x.subnet)).contains(ipv4)
                }).findIndex(x => x == true) != -1;

                if (isInSubnets && this.watchForServersSubject != null) {
                  this.watchForServersSubject.next({ server: new ServerModel(ipv4, service.hostname), action: action });
                }
              }
            })
          });
        }
      });
    });
    // return observable to prevent to call .next() by accident from the outside
    return this.watchForServersSubject.asObservable();
  }

  async stopWatchForServers() {
    console.error("[S] stopWatchForServers()")
    if (this.watchForServersSubject) {
      this.watchForServersSubject.complete();
      this.watchForServersSubject = null;
    }
    this.zeroconf.close();
  }

  // isConnectedWith(server: ServerModel) {
  //   if (this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
  //     return false;
  //   }
  //   return true;
  // }

  private clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      this.reconnecting = false;
      console.log("[S]: interval cleared.")
    }
  }

  private scheduleNewWsConnection(server) {
    console.log('[S-snwc]: scheduleNewWsConnection()->')
    this.reconnecting = true;
    if (this.pongTimeout) clearTimeout(this.pongTimeout);
    if (this.heartBeatInterval) clearInterval(this.heartBeatInterval);
    if (!this.reconnectInterval) {
      if (this.serverQueue.length) {
        console.log('[S-snwc]:    server queue is not empty, attemping a new reconnection whithout waiting')
        server = this.serverQueue.shift(); // Removes the first element from an array and returns it
        this.wsConnect(server);
      } else {
        console.log('[S-snwc]:    server queue is empty, attemping a new reconnection to the same server in ' + ServerProvider.RECONNECT_INTERVAL + ' secs');
        this.reconnectInterval = setInterval(() => {
          this.wsConnect(server);
        }, ServerProvider.RECONNECT_INTERVAL);
      }
    }
  }

  private isVersionMismatchDialogVisible = false;
  private showVersionMismatch() {
    if (!this.isVersionMismatchDialogVisible) {
      let dialog = this.alertCtrl.create({
        title: 'Server/app version mismatch',
        message: 'Please update both app and server, otherwise they may not work properly.<br><br>Server can be downloaded at ' + Config.WEBSITE_NAME,
        buttons: [
          {
            text: 'Ok',
            role: 'cancel'
          }
        ]
      });
      dialog.didLeave.subscribe(() => {
        this.isVersionMismatchDialogVisible = false;
      })
      this.isVersionMismatchDialogVisible = true;
      dialog.present();
    }
  }
}
