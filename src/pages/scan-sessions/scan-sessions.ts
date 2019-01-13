import { Settings } from './../../providers/settings';
import { Config } from '../../providers/config';
import { Component } from '@angular/core';
import { PopoverController, NavController, AlertController } from 'ionic-angular';
import { ScanSessionModel } from '../../models/scan-session.model'
import { ScanSessionPage } from '../scan-session/scan-session'
import { SelectServerPage } from '../select-server/select-server'
import { ServerProvider } from '../../providers/server'
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage'
import { Device } from '@ionic-native/device';
import { Market } from '@ionic-native/market';
import * as Promise from 'bluebird'
import { responseModel, responseModelHelo } from '../../models/response.model';
import { wsEvent } from '../../models/ws-event.model';
import { requestModelDeleteScanSession } from '../../models/request.model';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  public connected = false;
  public scanSessions: ScanSessionModel[] = [];
  private responseSubscription = null;
  private wsEventSubscription = null;

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private ga: GoogleAnalytics,
    private settings: Settings,
    private market: Market,
    private device: Device,
  ) { }

  ionViewDidEnter() {

    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;


      // Compute the scans per month
      let currentMonth = new Date().getMonth();
      let previusMonth;
      let tmp = new Date();
      tmp.setDate(1);
      tmp.setMonth(tmp.getMonth() - 1);
      previusMonth = tmp.getMonth();

      this.settings.getLastMonth().then(lastMonth => { // if lastMonth == null the promise won't be resolved
        console.log('[GA] lastMonth is ' + lastMonth);

        if (lastMonth != null && lastMonth != currentMonth) { // if the month has changed
          console.log('[GA] lastMonth !=  currentMonth (' + lastMonth + ' !=  ' + currentMonth + ')');

          let tot = 0;
          for (let session of this.scanSessions) {
            if (session.date.getMonth() != previusMonth) break;

            if (session.scannings) {
              tot += session.scannings.length;
            }
          }

          let metricName = '1';
          if (tot > 10000) {
            metricName = '5';
          } else if (tot > 5000) {
            metricName = '4';
          } else if (tot > 1000) {
            metricName = '3';
          } else if (tot > 100) {
            metricName = '2';
          }

          console.log('[GA] tot = ' + tot, '  metricName = ' + metricName + ' trackMetric()');
          this.ga.addCustomDimension(1, this.device.platform);
          this.ga.trackMetric(metricName, 1)
        }
        console.log('[GA] save lastMonth = ' + currentMonth);
        this.settings.setLastMonth(currentMonth);
        this.ga.trackView('ScanSessionsPage');
      })
    }); // getScanSessions

    console.log('ionViewDidEnter');

    // if (this.connected == false) {
    this.settings.getDefaultServer().then(server => {
      // console.log('SERVER: ', server)

      if (!this.wsEventSubscription) {
        this.wsEventSubscription = this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
          console.log('[S-SESSIONS]: ' + event.name)
          if (event.name == wsEvent.EVENT_OPEN) {
            this.onConnect();
          } else if (event.name == wsEvent.EVENT_CLOSE) {
            this.connected = false;
          } else if (event.name == wsEvent.EVENT_ERROR) {
            this.connected = false;
          } else if (event.name == wsEvent.EVENT_ALREADY_OPEN) {
            this.connected = true;
          }
        });
      }


      // if (!this.responseSubscription) {
      //   this.responseSubscription = this.serverProvider.onResponse().subscribe((response: any) => {

      //   });
      // }

      console.log('[S-SESSIONS]: connect()')
      this.serverProvider.connect(server);
    }, err => { })
    // }
  }

  ionViewDidLoad() {

  }

  ionViewDidLeave() {
    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
      this.responseSubscription = null;
    }

    if (this.wsEventSubscription) {
      this.wsEventSubscription.unsubscribe();
      this.wsEventSubscription = null;
    }
  }

  onConnect() {
    this.connected = true;

    Promise.join(this.settings.getNoRunnings(), this.settings.getRated(), (runnings, rated) => {
      console.log('promise join: getNoRunnings getRated getDeviceName ')
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