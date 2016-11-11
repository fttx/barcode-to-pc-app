import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';
import { ScanSessionModel } from '../models/scan-session.model'

/*
  Generated class for the Settings provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ScanSessionsStorage {
  private static SCAN_SESSIONS = "scan_sessions";

  constructor(
    public storage: Storage,
  ) { }

  setScanSessions(scanSessions: ScanSessionModel[]) {
    return this.storage.set(ScanSessionsStorage.SCAN_SESSIONS, JSON.stringify(scanSessions));
  }

  // TODO verificare se ionic/storage implementa cache altrimenti farla qui
  getScanSessions(): Promise<ScanSessionModel[]> {
    return new Promise((resolve, reject) => {
      this.storage.get(ScanSessionsStorage.SCAN_SESSIONS).then((data) => {
        if (data != null) {
          let json = JSON.parse(data);
          let result = json.map(x => {
            let scanSession: ScanSessionModel = {
              name: x.name,
              date: new Date(x.date),
              scannings: x.scannings
            }
            return scanSession;
          });
          resolve(result)
        } else {
          resolve([])
        }
      });
    });
  }

  setScanSession(scanSession: ScanSessionModel) {
    return this.getScanSessions().then(sessions => {
      let existingSessionIndex = sessions.findIndex((x) => x.date.valueOf() == scanSession.date.valueOf());
      if (existingSessionIndex == -1) {
        sessions.unshift(scanSession); // insert at the beginning of the array
      } else {
        sessions[existingSessionIndex] = scanSession;
      }
      this.setScanSessions(sessions);
    })
  }


  /*

  setNoRunnings(noRunnings: number) {
    return this.storage.set(ScanSessionStorage.FIRST_RUN, noRunnings);
  }

  getNoRunnings() {
    return this.storage.get(ScanSessionStorage.FIRST_RUN);
  }*/
}
