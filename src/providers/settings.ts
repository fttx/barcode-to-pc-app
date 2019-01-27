import { Injectable, NgZone } from '@angular/core';
import { Device } from '@ionic-native/device';
import { Storage } from '@ionic/storage';
import { barcodeFormatModel } from '../models/barcode-format.model';
import { ServerModel } from '../models/server.model';
import { SplashScreen } from '@ionic-native/splash-screen';


/*
  Generated class for the Settings provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Settings {
  private static DEFAULT_SERVER = "default_server";
  private static NO_RUNNINGS = "first_run";
  private static CONTINUE_MODE_TIMEOUT = "continuemode_timeout";
  private static RATED = "rated";
  private static MANUALLY_ADDED = "manually_added";
  private static EVER_CONNECTED = "ever_connected";
  private static ALWAYS_SKIP_WELCOME_PAGE = "always_skip_welcome_page";
  private static SCAN_MODE = 'scan_mode';
  private static DEVICE_NAME = 'device_name';
  private static REPEAT_INTERVAL = 'repeat_interval';
  private static PREFER_FRONT_CAMERA = 'prefer_front_camera';
  private static UPGRADED_TO_SQLITE = 'upgraded_to_sqlite_5x';
  private static LAST_VERSION = 'last_version';
  private static BARCODE_FORMATS = 'barcode_formats';
  private static ENABLE_LIMIT_BARCODE_FORMATS = 'enable_limit_barcode_formats';
  private static QUANTITY_ENABLED = 'quantity_enabled';
  private static QUANTITY_TYPE = 'quantity_type';

  constructor(
    public storage: Storage,
    public device: Device,
    public ngZone: NgZone,
    public splashScreen: SplashScreen,
  ) {
    let indexeddb = new Storage({ driverOrder: ['indexeddb'] });

    Promise.all([this.storage.ready(), indexeddb.ready()]).then(result => {
      this.storage.get(Settings.UPGRADED_TO_SQLITE).then(upgradedToSqlite => {
        // alert('[STORAGE]  storage.get(upgraded) = ' + upgradedToSqlite)
        upgradedToSqlite = false;
        if (!upgradedToSqlite) {
          indexeddb.get("scan_sessions").then(oldScanSessions => {
            // alert('[STORAGE]  indexeddb.get(upgraded) = ' + oldScanSessions)

            // this function is required to keep both old and new scan sessions
            let doMerge = (newScanSessions = null) => {
              // alert('typeof oldScanSessions = ' + typeof (oldScanSessions) + ' ' + oldScanSessions)
              // alert('typeof newScanSessions = ' + typeof (newScanSessions) + ' ' + newScanSessions)

              let resultArray = [];
              let resultStr = '';
              if (oldScanSessions) {
                resultArray.push(...JSON.parse(oldScanSessions))
              }
              if (newScanSessions) {
                resultArray.push(...JSON.parse(newScanSessions))
              }
              resultStr = JSON.stringify(resultArray);
              // alert('resultStr = ' + resultStr);

              // JSON PARSE, [].PUSH(ARRAY1), [].PUSH(ARRAY2)
              // Dopo di che provare v2.0.1 -> v2.0.3 -> v3.0.0
              Promise.all([
                this.storage.set("scan_sessions", resultStr),
                this.storage.set(Settings.UPGRADED_TO_SQLITE, true),
              ]).then(() => {
                alert('Upgrading, tap OK to continue')
                setTimeout(() => {
                  this.ngZone.run(() => {
                    this.splashScreen.show();
                    window.location.reload();
                  });
                }, 1000)
              })
            }


            this.storage.get("scan_sessions").then(newScanSessions => {
              // alert('checking for corruption...');

              let corrupted = newScanSessions && typeof (newScanSessions) != 'string';
              if (corrupted) {
                newScanSessions = '[]';
                // alert('newScanSessions are corrupted, resetting. newScanSessions=[]')
              }

              if (oldScanSessions || corrupted) {
                // alert('upgrading...');
                doMerge(newScanSessions);
              } else {
                // alert('no need to upgrade');
                this.storage.set(Settings.UPGRADED_TO_SQLITE, true);
              }
            })

          })
        }


      })
    });
  }

  setDefaultServer(server: ServerModel) {
    if (!server) {
      this.storage.remove(Settings.DEFAULT_SERVER);
    }
    return this.storage.set(Settings.DEFAULT_SERVER, JSON.stringify(server));
  }

  getDefaultServer(): Promise<ServerModel> {
    return new Promise((resolve, reject) => {
      this.storage.get(Settings.DEFAULT_SERVER).then((data) => {
        console.log('getDefaultServer()', data)
        if (data && data != '' && data != 'null') {
          console.log('resolve')
          data = JSON.parse(data);
          let server = new ServerModel(data.address, data.name);
          resolve(server);
        } else {
          reject();
        }
      });
    });
  }

  setEverConnected(everConnected: boolean) {
    return this.storage.set(Settings.EVER_CONNECTED, everConnected);
  }

  getEverConnected(): Promise<boolean> {
    return this.storage.get(Settings.EVER_CONNECTED);
  }

  setAlwaysSkipWelcomePage(alwaysSkipWelcomePage: boolean) {
    return this.storage.set(Settings.ALWAYS_SKIP_WELCOME_PAGE, alwaysSkipWelcomePage);
  }

  getAlwaysSkipWelcomePage(): Promise<boolean> {
    return this.storage.get(Settings.ALWAYS_SKIP_WELCOME_PAGE);
  }

  setNoRunnings(noRunnings: number) {
    return this.storage.set(Settings.NO_RUNNINGS, noRunnings);
  }

  getNoRunnings(): Promise<number> {
    return this.storage.get(Settings.NO_RUNNINGS);
  }

  setLastVersion(lastVersion: string) {
    return this.storage.set(Settings.LAST_VERSION, lastVersion);
  }

  getLastVersion(): Promise<string> {
    return this.storage.get(Settings.LAST_VERSION);
  }

  setContinueModeTimeout(seconds: number) {
    return this.storage.set(Settings.CONTINUE_MODE_TIMEOUT, seconds);
  }

  getContinueModeTimeout(): Promise<number> {
    return this.storage.get(Settings.CONTINUE_MODE_TIMEOUT);
  }

  setRated(rated: boolean) {
    return this.storage.set(Settings.RATED, rated);
  }

  getRated(): Promise<boolean> {
    return this.storage.get(Settings.RATED);
  }

  setSavedServers(servers: ServerModel[]) {
    return this.storage.set(Settings.MANUALLY_ADDED, JSON.stringify(servers));
  }

  getSavedServers(): Promise<ServerModel[]> {
    return new Promise((resolve, reject) => {
      return this.storage.get(Settings.MANUALLY_ADDED).then(data => {
        console.log("DATA", data);
        if (data) {
          let servers = JSON.parse(data).map(x => new ServerModel(x.address, x.name));
          resolve(servers)
        } else {
          reject();
        }
      });
    });
  }

  saveServer(server: ServerModel) {
    this.getSavedServers().then((savedServers: ServerModel[]) => {
      let alredyPresent = savedServers.find(x => x.equals(server));
      if (alredyPresent) {
        savedServers.splice(savedServers.indexOf(alredyPresent), 1);
      }
      savedServers.push(server);
      this.setSavedServers(savedServers);
    },
      err => {
        this.setSavedServers([server]);
      }
    );
  }

  deleteServer(server: ServerModel) {
    this.getSavedServers().then((savedServers: ServerModel[]) => {
      let deleteServer = savedServers.find(x => x.equals(server));
      if (deleteServer) {
        savedServers.splice(savedServers.indexOf(deleteServer), 1);
        this.setSavedServers(savedServers);
      }
    },
      err => { }
    );
  }

  setDefaultMode(scanMode) {
    return this.storage.set(Settings.SCAN_MODE, scanMode);
  }

  getDefaultMode(): Promise<string> {
    return this.storage.get(Settings.SCAN_MODE);
  }


  setDeviceName(deviceName: string) {
    return this.storage.set(Settings.DEVICE_NAME, deviceName);
  }
  getDeviceName(): Promise<string> {
    return new Promise(resolve => {
      this.storage.get(Settings.DEVICE_NAME).then(deviceName => {
        if (!deviceName) {
          resolve(this.device.model);
        } else {
          resolve(deviceName)
        }
      });
    });
  }

  setRepeatInterval(interval: number) {
    return this.storage.set(Settings.REPEAT_INTERVAL, interval);
  }
  getRepeatInterval(): Promise<number> {
    return this.storage.get(Settings.REPEAT_INTERVAL);
  }

  setPreferFrontCamera(preferFrontCamera: boolean) {
    return this.storage.set(Settings.PREFER_FRONT_CAMERA, preferFrontCamera);
  }
  getPreferFrontCamera(): Promise<boolean> {
    return this.storage.get(Settings.PREFER_FRONT_CAMERA);
  }

  setEnableLimitBarcodeFormats(enableLimitBarcodeFormats: boolean) {
    return this.storage.set(Settings.ENABLE_LIMIT_BARCODE_FORMATS, enableLimitBarcodeFormats);
  }

  getEnableLimitBarcodeFormats(): Promise<boolean> {
    return this.storage.get(Settings.ENABLE_LIMIT_BARCODE_FORMATS);
  }

  setBarcodeFormats(barcodeFormats: barcodeFormatModel[]) {
    return this.storage.set(Settings.BARCODE_FORMATS, barcodeFormats);
  }

  getBarcodeFormats(): Promise<barcodeFormatModel[]> {
    return new Promise((resolve, reject) => {
      this.storage.get(Settings.BARCODE_FORMATS).then((barcodeFormats) => {
        if (barcodeFormats && barcodeFormats.length) {
          resolve(barcodeFormats.map(element => {
            return new barcodeFormatModel(element.name, element.enabled)
          }));
        } else {
          resolve(barcodeFormatModel.supportedBarcodeFormats);
        }
      }).catch(() => reject())
    });
  }

  setQuantityEnabled(enabled: boolean) {
    return this.storage.set(Settings.QUANTITY_ENABLED, enabled);
  }

  getQuantityEnabled(): Promise<boolean> {
    return this.storage.get(Settings.QUANTITY_ENABLED);
  }

  setQuantityType(type: string) {
    return this.storage.set(Settings.QUANTITY_TYPE, type);
  }

  getQuantityType(): Promise<string> {
    return this.storage.get(Settings.QUANTITY_TYPE);
  }
}
