import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

import { ScanSessionModel } from '../models/scan-session.model';

/*
  Generated class for the Settings provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class ScanSessionsStorage {
  private static SCAN_SESSIONS = "scan_sessions";
  private static ARCHIVED_SCAN_SESSIONS = 'archived_scan_sessions';
  private static LAST_SCAN_DATE = 'last_modified';

  constructor(
    public storage: Storage,
  ) { }

  // Scan sessions

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
              id: x.id,
              name: x.name,
              date: x.date,
              scannings: x.scannings,
              selected: false,
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
      this.setScanSessions(sessions);
    })
  }



  
  // Archived scan sessions

  setArchivedScanSessions(scanSessions: ScanSessionModel[]) {
    return this.storage.set(ScanSessionsStorage.ARCHIVED_SCAN_SESSIONS, JSON.stringify(scanSessions));
  }

  getArchivedScanSessions(): Promise<ScanSessionModel[]> {
    return new Promise((resolve, reject) => {
      this.storage.get(ScanSessionsStorage.ARCHIVED_SCAN_SESSIONS).then((data) => {
        if (data != null) {
          let json = JSON.parse(data);
          let result = json.map(x => {
            let scanSession: ScanSessionModel = {
              id: x.id,
              name: x.name,
              date: x.date,
              scannings: x.scannings,
              selected: false,
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

  pushArchivedScanSessions(scanSessions: ScanSessionModel[]) {
    scanSessions.forEach(x => this.pushArchivedScanSession(x));
  }

  pushArchivedScanSession(scanSession: ScanSessionModel) {
    return this.getArchivedScanSessions().then(sessions => {
      let existingSessionIndex = sessions.findIndex((x) => x.id == scanSession.id);
      if (existingSessionIndex == -1) {
        sessions.unshift(scanSession); // insert at the beginning of the array
      } else {
        sessions[existingSessionIndex] = scanSession;
      }
      this.setArchivedScanSessions(sessions);
    })
  }
}
