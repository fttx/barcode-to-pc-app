import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { ServerModel } from '../models/server.model'
import { Device } from "@ionic-native/device";

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

  constructor(
    public storage: Storage,
    public device: Device
  ) { }

  setDefaultServer(server: ServerModel) {
    return this.storage.set(Settings.DEFAULT_SERVER, JSON.stringify(server));
  }

  getDefaultServer(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.get(Settings.DEFAULT_SERVER).then((data) => {
        if (data != null) {
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
}
