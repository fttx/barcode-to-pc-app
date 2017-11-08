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
import { responseModel, responseModelHelo, responseModelRequestSync } from '../../models/response.model';
import { wsEvent } from '../../models/ws-event.model';
import { requestModelHelo, requestModelDeleteScanSession } from '../../models/request.model';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  public connected = false;
  public scanSessions: ScanSessionModel[] = [];
  private responseSubscription = null;

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

    this.responseSubscription = this.serverProvider.onResponse().subscribe(response => {

    });

    if (this.connected == false) {
      this.settings.getDefaultServer().then(server => {
        this.serverProvider.onResponse().subscribe((response: any) => {
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
        } else if (event.name == wsEvent.EVENT_ALREADY_OPEN) {
          this.connected = true;
        }
      });
    }
  }

  ionViewDidLeave() {
    if (this.responseSubscription != null && this.responseSubscription) {
      this.responseSubscription.unsubscribe();
    }
  }

  onConnect() {
    this.connected = true;

    Promise.join(this.settings.getNoRunnings(), this.settings.getRated(), this.settings.getDeviceName(), this.scanSessionsStorage.getLastScanDate(), (runnings, rated, deviceName, lastScanDate) => {
      console.log('promise join: getNoRunnings getRated getDeviceName ')
      let request = new requestModelHelo().fromObject({
        deviceName: deviceName,
        deviceId: this.device.uuid,
        lastScanDate: lastScanDate,
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
    console.log('onDisconnect()')
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

  sendDeleteScanSessions(scanSession: ScanSessionModel) {
    let wsRequest = new requestModelDeleteScanSession().fromObject({
      scanSessionId: scanSession.id
    });
    this.serverProvider.send(wsRequest);
  }

  save() {
    this.scanSessionsStorage.putScanSessions(this.scanSessions);
  }
}