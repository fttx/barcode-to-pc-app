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
    console.log("setScanSessions: ", scanSessions)
    return this.storage.set(ScanSessionsStorage.SCAN_SESSIONS, JSON.stringify(scanSessions));
  }

  // TODO verificare se ionic/storage implementa cache altrimenti farla qui
  getScanSessions(): Promise<ScanSessionModel[]> {
    return new Promise((resolve, reject) => {
      this.storage.get(ScanSessionsStorage.SCAN_SESSIONS).then((data) => {
        if (data != null) {
          resolve(JSON.parse(data))
        } else {
          resolve([])
        }
      });
    });
  }

  setScanSession(scanSession: ScanSessionModel) {
    console.log("setScanSession: ", scanSession)
    
    return this.getScanSessions().then(sessions => {
      let existingSessionIndex = sessions.findIndex(x => x.date == scanSession.date);
      if (existingSessionIndex == -1) {
        sessions.push(scanSession);
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
