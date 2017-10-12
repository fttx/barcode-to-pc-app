import { Settings } from './../../providers/settings';
import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { PopoverController, NavController, AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'
import { GoogleAnalyticsService } from '../../providers/google-analytics'
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import { Device } from '@ionic-native/device';
import { Market } from '@ionic-native/market';
import * as Promise from 'bluebird'
import { responseModel, responseModelHelo } from '../../models/response.model';
import { wsEvent } from '../../models/ws-event.model';
import { requestModelHelo, requestModelSetScanSessions, requestModelDeleteScanSession } from '../../models/request.model';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  public connected = false;
  public scanSessions: ScanSessionModel[] = [];

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private googleAnalytics: GoogleAnalyticsService,
    private settings: Settings,
    private market: Market,
    private device: Device,
  ) { }

  ionViewDidEnter() {
    this.googleAnalytics.trackView("ScanSessionsPage");
    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
    });

    if (this.connected == false) {
      this.settings.getDefaultServer().then(server => {
        this.serverProvider.onResponse().subscribe((response: any) => {
          console.log('onMessage()', response)
          if (response.action == responseModel.ACTION_HELO) {
            let heloResponse: responseModelHelo = response;
            if (heloResponse.version != Config.REQUIRED_SERVER_VERSION) {
              this.onVersionMismatch();
            }
          }
        });
        this.serverProvider.connect(server);
      }, err => { })

      this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
        if (event.name == wsEvent.EVENT_OPEN) {
          this.onConnect();
        } else if (event.name == wsEvent.EVENT_CLOSE) {
          this.onDisconnect();
        } else if (event.name == wsEvent.EVENT_ERROR) {
          this.onDisconnect();
        }
      });
    }
  }

  onConnect() {
    this.connected = true;
    this.sendPutScanSessions();

    Promise.join(this.settings.getNoRunnings(), this.settings.getRated(), this.settings.getDeviceName(), (runnings, rated, deviceName) => {
      console.log('promise join: getNoRunnings getRated getDeviceName ')
      let request = new requestModelHelo().fromObject({
        deviceName: deviceName,
      });
      this.serverProvider.send(request);

      if (runnings >= Config.NO_RUNNINGS_BEFORE_SHOW_RATING && !rated) {
        let os = this.device.platform || 'unknown';
        let isAndroid = os.toLowerCase().indexOf('android') != -1;
        let store = isAndroid ? 'PlayStore' : 'Appstore';
        this.alertCtrl.create({
          title: 'Rate Barcode to PC',
          message: 'Are you enjoying Barcode to PC?<br><br>Please, rate it on the ' + store + ', it would be appreciated!',
          buttons: [{
            text: 'Remind me later',
            role: 'cancel'
          }, {
            text: 'No',
            handler: () => {
              this.settings.setRated(true);
            }
          }, {
            text: 'Rate',
            handler: () => {
              this.settings.setRated(true);
              if (isAndroid) {
                this.market.open('com.barcodetopc');
              } else {
                this.market.open('BarcodetoPC:Wi-Fiscanner');
              }
            }
          }]
        }).present();
      }
    });
  }

  onDisconnect() {
    this.connected = false;
  }


  onVersionMismatch() {
    this.alertCtrl.create({
      title: 'Server/app version mismatch',
      message: 'Please update both app and server, otherwise they may not work properly.<br><br>Server can be downloaded at <a href="' + Config.WEBSITE_URL + '">' + Config.WEBSITE_NAME + '</a>',
      buttons: [
        {
          text: 'Ok',
          role: 'cancel'
        }
      ]
    }).present();
  }

  onSelectServerClick() {
    this.navCtrl.push(SelectServerPage);
  }

  onItemSelected(scanSession) {
    this.navCtrl.push(ScanSessionPage, { scanSession: scanSession, isNewSession: false });
  }

  delete(scanSession, index) {
    this.alertCtrl.create({
      title: 'Confirm delete',
      message: 'Do you really want to delete ' + scanSession.name + '?',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          this.scanSessions.splice(index, 1);
          this.save();
          this.sendDeleteScanSessions(scanSession);
        }
      }]
    }).present();
  }

  onAddClick() {
    let date: Date = new Date();
    let newScanSession: ScanSessionModel = {
      id: date.getTime(),
      name: 'Scan session ' + (this.scanSessions.length + 1),
      date: date,
      scannings: []
    };
    this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, isNewSession: true });
  }

  sendPutScanSessions() {
    let wsRequest = new requestModelSetScanSessions().fromObject({
      scanSessions: this.scanSessions,
      sendKeystrokes: false
    });
    this.serverProvider.send(wsRequest);
  }

  sendDeleteScanSessions(scanSession: ScanSessionModel) {
    let wsRequest = new requestModelDeleteScanSession().fromObject({
      scanSessionId: scanSession.id
    });
    this.serverProvider.send(wsRequest);
  }

  save() {
    this.scanSessionsStorage.setScanSessions(this.scanSessions);
  }
}