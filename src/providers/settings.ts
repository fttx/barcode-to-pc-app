import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { ServerModel } from '../models/server.model'

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

  constructor(public storage: Storage) { }

  setDefaultServer(server: ServerModel) {
    return this.storage.set(Settings.DEFAULT_SERVER, JSON.stringify(server));
  }

  getDefaultServer(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.storage.get(Settings.DEFAULT_SERVER).then((data) => {
        if (data != null) {
          resolve(JSON.parse(data))
        } else {
          reject();
        }
      });
    });
  }

  setNoRunnings(noRunnings: number) {
    return this.storage.set(Settings.NO_RUNNINGS, noRunnings);
  }

  getNoRunnings() {
    return this.storage.get(Settings.NO_RUNNINGS);
  }

  setContinueModeTimeout(seconds: number) {
    return this.storage.set(Settings.CONTINUE_MODE_TIMEOUT, seconds);
  }

  getContinueModeTimeout() {
    return this.storage.get(Settings.CONTINUE_MODE_TIMEOUT);
  }


  setRated(rated: boolean) {
    return this.storage.set(Settings.RATED, rated);
  }

  getRated() {
    return this.storage.get(Settings.RATED);
  }
}
