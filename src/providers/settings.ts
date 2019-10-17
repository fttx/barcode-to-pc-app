import { Injectable, NgZone } from '@angular/core';
import { Device } from '@ionic-native/device';
import { SplashScreen } from '@ionic-native/splash-screen';
import { Storage } from '@ionic/storage';
import { barcodeFormatModel } from '../models/barcode-format.model';
import { OutputProfileModel } from '../models/output-profile.model';
import { ServerModel } from '../models/server.model';


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
  private static KEEP_DISPLAY_ON = 'keep_display_on';
  private static UPGRADED_TO_SQLITE = 'upgraded_to_sqlite_5x';
  private static LAST_VERSION = 'last_version';
  private static BARCODE_FORMATS = 'barcode_formats';
  private static ENABLE_LIMIT_BARCODE_FORMATS = 'enable_limit_barcode_formats';
  private static OUTPUT_PROFILES = 'output_profiles';
  private static SELECTED_OUTPUT_PROFILE = 'selected_output_profile';
  private static QUANTITY_ENABLED = 'quantity_enabled';
  private static QUANTITY_TYPE = 'quantity_type';
  private static SOUND_FEEDBACK_OR_DIALOG_SHOWN = 'sound_feedback_or_dialog_shown';
  private static SCAN_SESSION_NAME = 'scan_session_name';
  private static UPGRADED_DISPLAYVALUE = 'upgraded_displayvalue';

  constructor(
    public storage: Storage,
    public device: Device,
    public ngZone: NgZone,
    public splashScreen: SplashScreen,
  ) {
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
        if (data && data != '' && data != 'null') {
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
    return this.storage.get(Settings.LAST_VERSION).then(version => version || '0.0.0');
  }

  setUpgradedDisplayValue(upgradedDisplayValue: boolean) {
    return this.storage.set(Settings.UPGRADED_DISPLAYVALUE, upgradedDisplayValue);
  }

  getUpgradedDisplayValue(): Promise<boolean> {
    return this.storage.get(Settings.UPGRADED_DISPLAYVALUE).then(displayValue => displayValue || null);
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

  setSoundFeedbackOrDialogShown(soundFeedbackOrDialogShown: boolean) {
    return this.storage.set(Settings.SOUND_FEEDBACK_OR_DIALOG_SHOWN, soundFeedbackOrDialogShown);
  }

  getSoundFeedbackOrDialogShown(): Promise<boolean> {
    return this.storage.get(Settings.SOUND_FEEDBACK_OR_DIALOG_SHOWN);
  }

  setSavedServers(servers: ServerModel[]) {
    return this.storage.set(Settings.MANUALLY_ADDED, JSON.stringify(servers));
  }

  getSavedServers(): Promise<ServerModel[]> {
    return new Promise((resolve, reject) => {
      return this.storage.get(Settings.MANUALLY_ADDED).then(data => {
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

  setScanSessionName(scanSessionName: string) {
    return this.storage.set(Settings.SCAN_SESSION_NAME, scanSessionName);
  }
  getScanSessionName(): Promise<string> {
    return new Promise(resolve => {
      this.storage.get(Settings.SCAN_SESSION_NAME).then(scanSessionName => {
        if (!scanSessionName) {
          resolve("Scan session {{ scan_session_number }}");
        } else {
          resolve(scanSessionName)
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
    return this.storage.get(Settings.PREFER_FRONT_CAMERA).then(result => { return result || false });
  }

  setKeepDisplayOn(keepDisplayOn: boolean) {
    return this.storage.set(Settings.KEEP_DISPLAY_ON, keepDisplayOn);
  }
  getKeepDisplayOn(): Promise<boolean> {
    return this.storage.get(Settings.KEEP_DISPLAY_ON).then(result => { return result || false });
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

  setOutputProfiles(outputProfiles: OutputProfileModel[]) {
    return this.storage.set(Settings.OUTPUT_PROFILES, outputProfiles);
  }

  getOutputProfiles(): Promise<OutputProfileModel[]> {
    return new Promise<OutputProfileModel[]>(async (resolve, reject) => {
      let outputProfiles = await this.storage.get(Settings.OUTPUT_PROFILES);
      console.log(' @@@ saved output profiles: ', outputProfiles)
      if (!outputProfiles) {
        let defaultOutputProfile = this.generateDefaultOutputProfiles();
        console.log(' @@@   null => generating defautl one  ', defaultOutputProfile)
        resolve(defaultOutputProfile);
      } else {
        resolve(outputProfiles);
      }
    })
  }

  setSelectedOutputProfile(selectedOutputProfile: number) {
    return this.storage.set(Settings.SELECTED_OUTPUT_PROFILE, selectedOutputProfile);
  }

  async getSelectedOutputProfile(): Promise<number> {
    return await this.storage.get(Settings.SELECTED_OUTPUT_PROFILE) || 0;
  }

  setQuantityType(type: string) {
    return this.storage.set(Settings.QUANTITY_TYPE, type);
  }

  getQuantityType(): Promise<string> {
    return this.storage.get(Settings.QUANTITY_TYPE);
  }

  /**
   * Generates the default OuputProfile based on the QuantityEnabled settings,
   * TODO: In the future versions it should return only a BARCODE + ENTER value,
   * remove the getQuantityEnabled part.
   *
   * It should be keep in sync with the server SettingsModel class.
   */
  private generateDefaultOutputProfiles(): Promise<OutputProfileModel[]> {
    return new Promise((resolve, reject) => {
      /**
       * @deprecated
       */
      this.getQuantityEnabled().then(quantityEnabled => {
        if (quantityEnabled) {
          resolve([{
            name: "Output template 1",
            outputBlocks: [
              { name: 'BARCODE', value: 'BARCODE', type: 'barcode', editable: true, skipOutput: false },
              { name: 'TAB', value: 'tab', type: 'key', modifiers: [] },
              { name: 'QUANTITY', value: 'quantity', type: 'variable', editable: true, skipOutput: false, label: null },
              { name: 'ENTER', value: 'enter', type: 'key', modifiers: [] },
            ]
          }]);
        } else {
          // keep only this
          resolve([{
            name: "Output template 1",
            outputBlocks: [{ name: 'BARCODE', value: 'BARCODE', type: 'barcode', editable: true, skipOutput: false }, { name: 'ENTER', value: 'enter', type: 'key', modifiers: [] }]
          }]);
        }
      })
    })
  }

  /**
   * @deprecated Use OutputProfiles
   * This method is called from the HELO response and whenever a
   * new enableQuantity response is received
   */
  setQuantityEnabled(enabled: boolean) {
    return new Promise((resolve, reject) => {
      this.storage.set(Settings.QUANTITY_ENABLED, enabled).then(async () => { // store QUANTITY_ENABLED anyways
        // update the OutputProfiles accordinghly
        let defaultOutputProfiles = await this.generateDefaultOutputProfiles();
        this.setOutputProfiles(defaultOutputProfiles).then(() =>
          resolve()
        );
      });
    });
  }

  /**
   * @deprecated Use OutputProfiles
   */
  getQuantityEnabled(): Promise<boolean> {
    return this.storage.get(Settings.QUANTITY_ENABLED);
  }
}
