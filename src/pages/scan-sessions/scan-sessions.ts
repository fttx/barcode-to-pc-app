import { Component } from '@angular/core';
import { Device } from '@ionic-native/device';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { LaunchReview } from '@ionic-native/launch-review';
import * as Promise from 'bluebird';
import { AlertController, NavController, PopoverController, ItemSliding } from 'ionic-angular';

import { requestModelDeleteScanSessions } from '../../models/request.model';
import { ScanSessionModel } from '../../models/scan-session.model';
import { wsEvent } from '../../models/ws-event.model';
import { Config } from '../../providers/config';
import { ScanSessionsStorage } from '../../providers/scan-sessions-storage';
import { ServerProvider } from '../../providers/server';
import { ScanSessionPage } from '../scan-session/scan-session';
import { SelectServerPage } from '../select-server/select-server';
import { Settings } from './../../providers/settings';
import { Utils } from '../../providers/utils';
import { ScanModel } from '../../models/scan.model';

@Component({
  selector: 'page-scannings',
  templateUrl: 'scan-sessions.html',
})
export class ScanSessionsPage {
  public connected = false;
  public scanSessions: ScanSessionModel[] = [];
  public selectedScanSessions: ScanSessionModel[] = [];

  private responseSubscription = null;
  private wsEventSubscription = null;
  private preventClickTimeout = null;
  private clickDisabled = false;

  constructor(
    public navCtrl: NavController,
    private alertCtrl: AlertController,
    private serverProvider: ServerProvider,
    private scanSessionsStorage: ScanSessionsStorage,
    public popoverCtrl: PopoverController,
    private ga: GoogleAnalytics,
    private settings: Settings,
    private launchReview: LaunchReview,
    private device: Device,
    private utils: Utils
  ) { }

  ionViewDidEnter() {
    this.ga.trackView('ScanSessionsPage');

    this.scanSessionsStorage.getScanSessions().then(data => {
      this.scanSessions = data;
      if (Config.DEBUG && this.scanSessions.length == 0) {
        let scanSessionDate = new Date().getTime();
        for (let i = 0; i < 50; i++) {
          let scannings = [];
          scanSessionDate += Math.floor(Math.random() * 9999999) + 9999999;
          let scanDate = scanSessionDate;
          for (let j = 0; j < 1000; j++) {
            let scan = new ScanModel();
            scan.cancelled = false;
            scan.id = scanDate;
            scan.date = scanDate;
            scan.repeated = false;
            scan.text = Math.floor(Math.random() * 99999999999) + ''
            scannings.push(scan);
            scanDate += Math.floor(Math.random() * 2000) + 1500;
          }
          let newScanSession: ScanSessionModel = {
            id: scanSessionDate,
            name: 'Scan session ' + i,
            date: scanSessionDate,
            scannings: scannings,
            selected: false,
          };
          this.scanSessions.push(newScanSession);
        }
        this.scanSessionsStorage.setScanSessions(this.scanSessions)
      }
    });

    console.log('ionViewDidEnter');

    // if (this.connected == false) {
    this.settings.getDefaultServer().then(server => {
      // console.log('SERVER: ', server)

      if (!this.wsEventSubscription) {
        this.wsEventSubscription = this.serverProvider.onWsEvent().subscribe((event: wsEvent) => {
          console.log('[S-SESSIONS]: ' + event.name)
          this.connected = this.serverProvider.isConnected();
          if (event.name == wsEvent.EVENT_OPEN) {
            this.onConnect();
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

  ionViewWillLeave() {
    this.unselectAll();
  }

  private onConnect() {
    Promise.join(this.settings.getNoRunnings(), this.settings.getRated(), (runnings, rated) => {
      console.log('promise join: getNoRunnings getRated ')
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
              if (this.launchReview.isRatingSupported()) {
                this.launchReview.rating().then(result => {
                  if (result == 'shown') {
                    this.settings.setRated(true);
                  }
                });
              } else {
                this.launchReview.launch().then(() => {
                  this.settings.setRated(true);
                })
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

  onScanSessionClick(scanSession, index: number) {
    if (this.clickDisabled) return; // prevent click after long press

    if (this.selectedScanSessions.length == 0) {
      // this.cancelSelection();
      this.navCtrl.push(ScanSessionPage, { scanSession: scanSession, isNewSession: false });
    } else {
      this.select(scanSession, index);
    }
  }

  onSelectAllClick() {
    this.scanSessions.forEach(x => x.selected = true);
    this.selectedScanSessions = [].concat(this.scanSessions);
  }

  onScanSessionPress(scanSession: ScanSessionModel, index: number) {
    if (this.selectedScanSessions.length == 0) { // prevent click after long press
      if (this.preventClickTimeout) clearTimeout(this.preventClickTimeout);
      this.clickDisabled = true;
      this.preventClickTimeout = setTimeout(() => this.clickDisabled = false, 500);
    }

    this.select(scanSession, index);
  }

  onCancelSelectionClick() {
    this.unselectAll();
  }

  onDeleteClick(scanSession: ScanSessionModel, index: number, slidingItem: ItemSliding) {
    slidingItem.close();
    this.alertCtrl.create({
      title: 'Confirm delete',
      message: 'Do you really want to delete ' + scanSession.name + '?',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          if (!this.connected) {
            this.utils.showCannotPerformActionOffline();
            return;
          }

          this.removeScanSession(index);
          this.save();
          this.sendDeleteScanSessions([scanSession]);
        }
      }]
    }).present();
  }

  private unselectAll() {
    this.selectedScanSessions.forEach(x => x.selected = false);
    this.selectedScanSessions = [];
  }

  private select(scanSession: ScanSessionModel, index: number) {
    if (scanSession.selected) {
      scanSession.selected = false;
      if (this.selectedScanSessions.length == 1) {
        this.selectedScanSessions = [];
      } else {
        this.selectedScanSessions.splice(index, 1);
      }
    } else {
      scanSession.selected = true;
      this.selectedScanSessions.push(scanSession);
    }
  }

  onAddClick() {
    let date: number = new Date().getTime();
    let newScanSession: ScanSessionModel = {
      id: date,
      name: 'Scan session ' + (this.scanSessions.length + 1),
      date: date,
      scannings: [],
      selected: false,
    };
    this.navCtrl.push(ScanSessionPage, { scanSession: newScanSession, isNewSession: true });
  }

  onArchiveSelectedClick() {
    if (!this.connected) {
      this.utils.showCannotPerformActionOffline();
      return;
    }

    let wsRequest = new requestModelDeleteScanSessions().fromObject({
      scanSessionIds: this.selectedScanSessions.map(x => x.id)
    });
    this.serverProvider.send(wsRequest);

    this.scanSessions = this.scanSessions.filter(x => !x.selected);
    this.scanSessionsStorage.pushArchivedScanSessions(this.selectedScanSessions)
    this.unselectAll();
    this.save();
  }

  onDeleteSelectedClick() {
    this.alertCtrl.create({
      title: 'Confirm delete',
      message: 'Do you really want to delete the selected scan sessions?',
      buttons: [{
        text: 'Cancel', role: 'cancel'
      }, {
        text: 'Delete', handler: () => {
          if (!this.connected) {
            this.utils.showCannotPerformActionOffline();
            return;
          }

          this.sendDeleteScanSessions(this.selectedScanSessions);
          this.scanSessions = this.scanSessions.filter(x => !x.selected);
          this.unselectAll();
          this.save();
        }
      }]
    }).present();
  }

  // onClearScanSessionsClick() {
  //   this.alertCtrl.create({
  //     title: 'Confirm delete',
  //     message: 'Do you really want to delete ALL scan sessions?',
  //     buttons: [{
  //       text: 'Cancel', role: 'cancel'
  //     }, {
  //       text: 'Delete', handler: () => {
  //         if (!this.connected) {
  //           this.showCannotDeleteOffline();
  //           return;
  //         }

  //         this.scanSessions = [];
  //         this.save();
  //         this.sendClearScanSessions();
  //       }
  //     }]
  //   }).present();
  // }



  // private sendClearScanSessions() {
  //   this.serverProvider.send(new requestModelClearScanSessions().fromObject({}));
  // }

  private sendDeleteScanSessions(scanSessions: ScanSessionModel[]) {
    let wsRequest = new requestModelDeleteScanSessions().fromObject({
      scanSessionIds: scanSessions.map(x => { return x.id })
    });
    this.serverProvider.send(wsRequest);
  }

  private save() {
    this.scanSessionsStorage.setScanSessions(this.scanSessions);
  }

  private removeScanSession(index: number) {
    if (this.scanSessions.length == 1) {
      this.scanSessions = [];
    } else {
      this.scanSessions.splice(index, 1);
    }
  }
}