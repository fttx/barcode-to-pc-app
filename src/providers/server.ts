import { Injectable, NgZone, ComponentFactoryResolver } from '@angular/core';
import { AppVersion } from '@ionic-native/app-version';
import { Device } from '@ionic-native/device';
import { Zeroconf } from '@ionic-native/zeroconf';
import { Alert, AlertController, Events, Platform } from 'ionic-angular';
import { Observable, Subject, Subscription } from 'rxjs';
import { SemVer } from 'semver';
import { discoveryResultModel } from '../models/discovery-result';
import { requestModel, requestModelGetVersion, requestModelHelo, requestModelPing } from '../models/request.model';
import { responseModel, responseModelHelo, responseModelKick, responseModelPopup, responseModelUpdateOutputProfiles, responseModelEnableQuantity } from '../models/response.model';
import { wsEvent } from '../models/ws-event.model';
import { HelpPage } from '../pages/help/help';
import { Settings } from '../providers/settings';
import { ServerModel } from './../models/server.model';
import { Config } from './config';
import { LastToastProvider } from './last-toast/last-toast';
import { ScanProvider } from './scan';


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

  private connected = false;
  private webSocket: WebSocket;
  private responseObservable = new Subject<responseModel>();
  private wsEventObservable = new Subject<wsEvent>();
  private watchForServersObservable = null;
  private watchForServersObserver: Subscription;
  private reconnecting = false;
  private everConnected = false; // in the current session
  private connectionProblemAlert = false; // in the current session
  private serverQueue: ServerModel[] = [];

  private reconnectInterval = null;
  private heartBeatInterval = null;
  private pongTimeout = null;

  private fallBackTimeout = null;
  private popup: Alert = null;
  private continuoslyWatchForServers: boolean; // if true it still watches for new servers after a successfully connection, and if it finds a new server with the same name of the defaultServer it re-connects (this happens when the server has a new ip address)
  private kickedOut = false;

  private lastOnResumeSubscription = null;

  constructor(
    private settings: Settings,
    private scanProvider: ScanProvider,
    private NgZone: NgZone,
    private lastToast: LastToastProvider,
    private zeroconf: Zeroconf,
    private alertCtrl: AlertController,
    public platform: Platform,
    public device: Device,
    public events: Events,
    private appVersion: AppVersion,
  ) {

  }

  onResponse(): Subject<any> {
    return this.responseObservable;
  }

  onWsEvent(): Subject<wsEvent> {
    return this.wsEventObservable;
  }

  connect(server: ServerModel, skipQueue: boolean = false) {
    if (!this.webSocket || this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
      console.log('[S]: not connected or new server selected, creating a new WS connection...');
      this.wsConnect(server, skipQueue);
    } else if (this.webSocket.readyState == WebSocket.OPEN) {
      console.log('[S]: already connected to a server, no action taken');
      this.serverQueue = [];
      this.connected = true;
      this.wsEventObservable.next({ name: wsEvent.EVENT_ALREADY_OPEN, ws: this.webSocket });
    }
    //console.log('[S]: queue: ', this.serverQueue);
  }

  disconnect() {
    this.wsDisconnect(false);
  }

  isConnected() {
    return this.connected;
  }

  isReconnecting() {
    return this.reconnecting;
  }

  private wsDisconnect(reconnect = false) {
    console.log('[S]: wsDisconnect(reconnect=' + reconnect + ')', this.webSocket);

    if (this.webSocket) {
      if (this.everConnected && !this.reconnecting) {
        this.lastToast.present('Connection lost');
        this.connected = false;
        this.wsEventObservable.next({ name: wsEvent.EVENT_ERROR, ws: this.webSocket });
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

      let messageData = null;
      if (message.data) {
        messageData = JSON.parse(message.data);
      }

      console.log('responseModel action = ', messageData.action)
      if (messageData.action == responseModel.ACTION_HELO) {
        // fallBack for old server versions
        console.log('FallBack: new HELO request received, aborting fallback')
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
      } else if (messageData.action == responseModel.UPDATE_OUTPUT_PROFILES) {
        let responseModelUpdateOutputProfiles: responseModelUpdateOutputProfiles = messageData;
        this.settings.setOutputProfiles(responseModelUpdateOutputProfiles.outputProfiles);
        this.scanProvider.updateOutputProfile();
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
      } else {
        this.responseObservable.next(messageData);
      }
    }

    this.webSocket.onopen = () => {
      //console.log('[S]: onopen')
      this.connectionProblemAlert = false;
      this.everConnected = true; // for current instance
      this.settings.setEverConnected(true); // for statistics usage
      this.serverQueue = [];

      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      console.log("[S]: WS: reconnected successfully...")
      this.clearReconnectInterval();


      this.settings.saveServer(server);
      this.connected = true;
      if (!this.continuoslyWatchForServers) {
        console.log("[S]: stopping watching for servers")
        this.unwatch();
      } else {
        console.log("[S]: stopping watching for servers")
      }
      this.wsEventObservable.next({ name: 'open', ws: this.webSocket });
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
          console.log('[S]: WS pong not received, closing connection...')
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
        console.log('promise join: getDeviceName getRated getLastScanDate ')
        let request = new requestModelHelo().fromObject({
          version: await this.appVersion.getVersionNumber(),
          deviceName: deviceName,
          deviceId: this.device.uuid,
        });
        this.send(request);

        // fallBack for old server versions
        console.log('FallBack: new Helo sent, waiting for response...')
        if (this.fallBackTimeout) clearTimeout(this.fallBackTimeout);
        this.fallBackTimeout = setTimeout(() => {
          console.log('FallBack: new Helo response not received, sending old getVersion');
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


      if (!this.watchForServersObserver) {
        this.watchForServersObserver = this.watchForServers().subscribe((discoveryResult: discoveryResultModel) => {
          this.settings.getDefaultServer().then(defaultServer => {
            if (defaultServer.name == discoveryResult.server.name && discoveryResult.server.name.length && defaultServer.address != discoveryResult.server.address) { // if the server has the same name, but a different ip => ask to reconnect
              let alert = this.alertCtrl.create({
                title: "Reconnect",
                message: "It seems that the computer " + defaultServer.name + " changed ip address from \
                 " + defaultServer.address + " to " + discoveryResult.server.address + ", do you want to reconnect?",
                buttons: [{
                  text: 'No',
                  role: 'cancel',
                  handler: () => { }
                }, {
                  text: 'Reconnect',
                  handler: () => {
                    this.settings.setDefaultServer(discoveryResult.server); // override the defaultServer
                    this.settings.getSavedServers().then(savedServers => {
                      this.settings.setSavedServers(
                        savedServers
                          .filter(x => x.name != discoveryResult.server.name) // remove the old server
                          .concat(discoveryResult.server)) // add a new one
                    });
                    this.wsConnect(discoveryResult.server, true);
                  }
                }]
              });
              alert.present();
            } else if (defaultServer.name == discoveryResult.server.name && defaultServer.address == discoveryResult.server.address && this.everConnected) { // if the server was closed and open again => reconnect whitout asking
              this.wsConnect(discoveryResult.server, true);
            }
          })
        })
      }
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

  watchForServers(): Observable<discoveryResultModel> {
    if (this.watchForServersObservable) {
      return this.watchForServersObservable;
    }

    this.watchForServersObservable = Observable.create(observer => {
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
              if (ipv4 && ipv4.length) {
                observer.next({ server: new ServerModel(ipv4, service.hostname), action: action });
              }
            })
          });
        }
      });
    });
    return this.watchForServersObservable;
  }

  unwatch() {
    this.watchForServersObservable = null;
    if (this.watchForServersObserver) {
      this.watchForServersObserver.unsubscribe();
      this.watchForServersObserver = null;
    }
    //console.log('[S]: UNWATCHED ')
    this.zeroconf.close();
  }

  // isConnectedWith(server: ServerModel) {
  //   if (this.webSocket.readyState != WebSocket.OPEN || this.webSocket.url.indexOf(server.address) == -1) {
  //     return false;
  //   }
  //   return true;
  // }

  public setContinuoslyWatchForServers(continuoslyWatchForServers: boolean) {
    this.continuoslyWatchForServers = continuoslyWatchForServers;
    if (!continuoslyWatchForServers) {
      this.unwatch();
    }
  }

  private clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      this.reconnecting = false;
      console.log("[S]: interval cleared.")
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

  private isVersionMismatchDialogVisible = false;
  private showVersionMismatch() {
    if (!this.isVersionMismatchDialogVisible) {
      let dialog = this.alertCtrl.create({
        title: 'Server/app version mismatch',
        message: 'Please update both app and server, otherwise they may not work properly.<br><br>Server can be downloaded at <a href="' + Config.URL_WEBSITE + '">' + Config.WEBSITE_NAME + '</a>',
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
