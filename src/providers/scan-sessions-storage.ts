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
  private static LAST_SCAN_DATE = 'last_modified';

  constructor(
    public storage: Storage,
  ) { }

  putScanSessions(scanSessions: ScanSessionModel[]) {
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
              id: x.id,
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

  pushScanSession(scanSession: ScanSessionModel) {
    return this.getScanSessions().then(sessions => {
      let existingSessionIndex = sessions.findIndex((x) => x.id == scanSession.id);
      if (existingSessionIndex == -1) {
        sessions.unshift(scanSession); // insert at the beginning of the array
      } else {
        sessions[existingSessionIndex] = scanSession;
      }
      this.putScanSessions(sessions);
    })
  }

  setLastScanDate(date: number) {
    this.storage.set(ScanSessionsStorage.LAST_SCAN_DATE, date);
  }

  getLastScanDate(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.storage.get(ScanSessionsStorage.LAST_SCAN_DATE).then(lastScanDate => {
        if (lastScanDate) {
          resolve(lastScanDate);
        } else {
          resolve(0);
        }
      }).catch(err => reject(err)); 
    });
  }
}
