import { Injectable, NgZone } from '@angular/core';
import { Device } from '@ionic-native/device';
import { SplashScreen } from '@ionic-native/splash-screen';
import { Storage } from '@ionic/storage';
import { barcodeFormatModel } from '../models/barcode-format.model';
import { OutputProfileModel } from '../models/output-profile.model';
import { ServerModel } from '../models/server.model';
import { Utils } from './utils';


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
  private static ALWAYS_USE_DEFAULT_SCAN_SESSION_NAME = 'always_use_default_scan_session_name';
  private static PREFER_FRONT_CAMERA = 'prefer_front_camera';
  private static TORCH_ON = 'torch_on';
  private static KEEP_DISPLAY_ON = 'keep_display_on';
  private static ENABLE_BEEP = 'enable_beep';
  private static ENABLE_VIBRATION_FEEDBACK = 'enable_vibration_feedback';
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
  private static OPEN_SCAN_ON_START = 'open_scan_on_start';
  private static EVENT_ON_SMARTPHONE_CHARGE_ENABLED = 'event_on_smartphone_charge_enabled';
  private static OFFLINE_MODE_ENABLED = 'offline_mode_enabled';
  private static IS_PDA_DEVICE_DIALOG_SHOWN = 'is_pda_device_dialog_shown';
  private static ALWAYS_USE_CAMERA_FOR_SCAN_SESSION_NAME = 'always_use_camera_for_scan_session_name';
  private static UNSYNCED_DELETED_SCAN_SESIONS = 'unsynced_deleted_scan_sesions';
  private static UNSYNCED_RESTORED_SCAN_SESIONS = 'unsynced_restored_scan_sesions';
  private static DUPLICATE_BARCODE_SAVE_CHOICE_SHOWN = 'duplicate_barcode_save_choice_shown';
  private static DUPLICATE_BARCODE_CHOICE = 'duplicate_barcode_choice';
  private static SCAN_SESSION_FILTER = 'scan_session_filter';
  private static ALLOW_OUTPUT_TEMPLATE_SELECTION = 'allow_output_template_selection';
  private static ENABLE_REALTIME_SEND = 'enable_realtime_send';
  private static LAST_MISMATCH_VERSION = 'last_mismatch_version';

  constructor(
    public storage: Storage,
    public device: Device,
    public ngZone: NgZone,
    public splashScreen: SplashScreen,
    public utils: Utils,
  ) {
  }

  /**
   * Used for both deleted and archived scan sessions
   */
  setUnsyncedDeletedScanSesions(serverUUID: string, scanSessionIds: number[]) {
    return this.storage.set(Settings.UNSYNCED_DELETED_SCAN_SESIONS + serverUUID, JSON.stringify(scanSessionIds));
  }

  /**
   * Used for both deleted and archived scan sessions
   */
  getUnsyncedDeletedScanSesions(serverUUID: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      return this.storage.get(Settings.UNSYNCED_DELETED_SCAN_SESIONS + serverUUID).then(data => {
        if (data) {
          let scanSessionsIds = JSON.parse(data);
          resolve(scanSessionsIds)
        } else {
          resolve([]);
        }
      });
    });
  }


  setUnsyncedRestoredScanSesions(scanSessionIds: number[]) {
    return this.storage.set(Settings.UNSYNCED_RESTORED_SCAN_SESIONS, JSON.stringify(scanSessionIds));
  }

  getUnsyncedRestoredScanSesions(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      return this.storage.get(Settings.UNSYNCED_RESTORED_SCAN_SESIONS).then(data => {
        if (data) {
          let scanSessionsIds = JSON.parse(data);
          resolve(scanSessionsIds)
        } else {
          resolve([]);
        }
      });
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
        if (data && data != '' && data != 'null') {
          data = JSON.parse(data);
          let server = new ServerModel(data.address, data.name);
          resolve(server);
        } else {
          resolve(null);
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

  setIsPDADeviceDialogShown(shown: boolean) {
    return this.storage.set(Settings.IS_PDA_DEVICE_DIALOG_SHOWN, shown);
  }

  getIsPDADeviceDialogShown(): Promise<boolean> {
    return this.storage.get(Settings.IS_PDA_DEVICE_DIALOG_SHOWN);
  }

  setAlwaysSkipWelcomePage(alwaysSkipWelcomePage: boolean) {
    return this.storage.set(Settings.ALWAYS_SKIP_WELCOME_PAGE, alwaysSkipWelcomePage);
  }

  getAlwaysSkipWelcomePage(): Promise<boolean> {
    return this.storage.get(Settings.ALWAYS_SKIP_WELCOME_PAGE);
  }

  setOpenScanOnStart(openscanOnStart: boolean) {
    return this.storage.set(Settings.OPEN_SCAN_ON_START, openscanOnStart);
  }

  getOpenScanOnStart(): Promise<boolean> {
    return this.storage.get(Settings.OPEN_SCAN_ON_START).then(openscanOnStart => openscanOnStart || false);
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

  setLastMismatchVersion(lastVersion: string) {
    return this.storage.set(Settings.LAST_MISMATCH_VERSION, lastVersion);
  }

  getLastMismatchVersion(): Promise<string> {
    return this.storage.get(Settings.LAST_MISMATCH_VERSION).then(version => version || '0.0.0');
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
      this.storage.get(Settings.SCAN_SESSION_NAME).then(async scanSessionName => {
        if (!scanSessionName) {
          resolve((await this.utils.text('scanSessionName')) + " {{ scan_session_number }}");
        } else {
          resolve(scanSessionName)
        }
      });
    });
  }

  setScanSessionFilter(scanSessionFilter: string) {
    return this.storage.set(Settings.SCAN_SESSION_FILTER, scanSessionFilter);
  }

  getScanSessionFilter(): Promise<string> {
    return new Promise(resolve => {
      this.storage.get(Settings.SCAN_SESSION_FILTER).then(async scanSessionFilter => {
        if (!scanSessionFilter) {
          resolve('');
        } else {
          resolve(scanSessionFilter)
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

  setAlwaysUseDefaultScanSessionName(alwaysUseDefaultScanSessionName: boolean) {
    return this.storage.set(Settings.ALWAYS_USE_DEFAULT_SCAN_SESSION_NAME, alwaysUseDefaultScanSessionName);
  }

  getAlwaysUseDefaultScanSessionName(): Promise<boolean> {
    return this.storage.get(Settings.ALWAYS_USE_DEFAULT_SCAN_SESSION_NAME).then(result => { return result === true });
  }

  setAllowOutputTemplateSelection(allowOutputTemplateSelection: boolean) {
    return this.storage.set(Settings.ALLOW_OUTPUT_TEMPLATE_SELECTION, allowOutputTemplateSelection);
  }

  getAllowOutputTemplateSelection(): Promise<boolean> {
    return this.storage.get(Settings.ALLOW_OUTPUT_TEMPLATE_SELECTION).then(result => {
      if (result === true || result === false) {
        return result;
      } else {
        return true;
      }
    });
  }

  setAlwaysUseCameraForScanSessionName(alwaysUseCameraForScanSessionName: boolean) {
    return this.storage.set(Settings.ALWAYS_USE_CAMERA_FOR_SCAN_SESSION_NAME, alwaysUseCameraForScanSessionName);
  }

  getAlwaysUseCameraForScanSessionName(): Promise<boolean> {
    return this.storage.get(Settings.ALWAYS_USE_CAMERA_FOR_SCAN_SESSION_NAME).then(result => { return result === true });
  }

  setPreferFrontCamera(preferFrontCamera: boolean) {
    return this.storage.set(Settings.PREFER_FRONT_CAMERA, preferFrontCamera);
  }

  getPreferFrontCamera(): Promise<boolean> {
    return this.storage.get(Settings.PREFER_FRONT_CAMERA).then(result => { return result === true });
  }

  setTorchOn(torchOn: boolean) {
    return this.storage.set(Settings.TORCH_ON, torchOn);
  }

  getTorchOn(): Promise<boolean> {
    return this.storage.get(Settings.TORCH_ON).then(result => { return result === true });
  }

  setKeepDisplayOn(keepDisplayOn: boolean) {
    return this.storage.set(Settings.KEEP_DISPLAY_ON, keepDisplayOn);
  }
  getKeepDisplayOn(): Promise<boolean> {
    return this.storage.get(Settings.KEEP_DISPLAY_ON).then(result => { return result === true });
  }

  setDuplicateBarcodeSaveChoiceShown(duplicateBarcodeSaveChoiceShown: boolean) {
    return this.storage.set(Settings.DUPLICATE_BARCODE_SAVE_CHOICE_SHOWN, duplicateBarcodeSaveChoiceShown);
  }
  getDuplicateBarcodeSaveChoiceShown(): Promise<boolean> {
    return this.storage.get(Settings.DUPLICATE_BARCODE_SAVE_CHOICE_SHOWN).then(result => { return result === true });
  }

  setDuplicateBarcodeChoice(choice: ('ask' | 'always_accept' | 'discard_adjacent' | 'discard_scan_session')) {
    return this.storage.set(Settings.DUPLICATE_BARCODE_CHOICE, choice);
  }
  getDuplicateBarcodeChoice(): Promise<('ask' | 'always_accept' | 'discard_adjacent' | 'discard_scan_session')> {
    return this.storage.get(Settings.DUPLICATE_BARCODE_CHOICE).then(result => { return result || 'ask' });
  }

  setEnableBeep(enableBeep: boolean) {
    console.log('save: ', Settings.ENABLE_BEEP, enableBeep)
    return this.storage.set(Settings.ENABLE_BEEP, enableBeep);
  }

  getEnableBeep(): Promise<boolean> {
    return this.storage.get(Settings.ENABLE_BEEP).then(result => { return result === true });
  }

  setEnableVibrationFeedback(enableVibrationFeedback: boolean) {
    console.log('save: ', Settings.ENABLE_VIBRATION_FEEDBACK, enableVibrationFeedback)
    return this.storage.set(Settings.ENABLE_VIBRATION_FEEDBACK, enableVibrationFeedback);
  }

  getEnableVibrationFeedback(): Promise<boolean> {
    return this.storage.get(Settings.ENABLE_VIBRATION_FEEDBACK).then(result => { return result === true });
  }

  setEnableLimitBarcodeFormats(enableLimitBarcodeFormats: boolean) {
    return this.storage.set(Settings.ENABLE_LIMIT_BARCODE_FORMATS, enableLimitBarcodeFormats);
  }

  getEnableLimitBarcodeFormats(): Promise<boolean> {
    return this.storage.get(Settings.ENABLE_LIMIT_BARCODE_FORMATS).then(result => { return result === true });
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
    return await this.storage.get(Settings.SELECTED_OUTPUT_PROFILE).then(result => { return result || 0 });
  }

  /**
   * @deprecated see src/pages/settings/settings.ts/ionViewDidLoad()/getQuantityType()
   */
  setQuantityType(type: string) {
    return this.storage.set(Settings.QUANTITY_TYPE, type);
  }

  /**
   * @deprecated
   */
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
            version: null,
            outputBlocks: [
              { name: 'BARCODE', value: 'BARCODE', type: 'barcode', editable: true, skipOutput: false, label: null, enabledFormats: [], filter: null, errorMessage: null },
              { name: 'TAB', value: 'tab', type: 'key', modifiers: [] },
              { name: 'NUMBER', value: 'number', type: 'variable', editable: true, skipOutput: false, label: null, filter: null, errorMessage: null, defaultValue: '1' },
              { name: 'ENTER', value: 'enter', type: 'key', modifiers: [] },
            ]
          }]);
        } else {
          // keep only this
          resolve([{
            version: null,
            name: "Output template 1",
            outputBlocks: [
              { name: 'BARCODE', value: 'BARCODE', type: 'barcode', editable: true, skipOutput: false, label: null, enabledFormats: [], filter: null, errorMessage: null },
              { name: 'ENTER', value: 'enter', type: 'key', modifiers: [] },
            ]
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
    return new Promise<void>((resolve, reject) => {
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
    return this.storage.get(Settings.QUANTITY_ENABLED).then(result => { return result === true });
  }

  setEventsOnSmartphoneChargeEnabled(enabled: boolean) {
    return this.storage.set(Settings.EVENT_ON_SMARTPHONE_CHARGE_ENABLED, enabled);
  }
  getEventsOnSmartphoneChargeEnabled(): Promise<boolean> {
    return this.storage.get(Settings.EVENT_ON_SMARTPHONE_CHARGE_ENABLED).then(result => { return result === true });
  }

  setOfflineModeEnabled(enabled: boolean) {
    return this.storage.set(Settings.OFFLINE_MODE_ENABLED, enabled);
  }
  getOfflineModeEnabled(): Promise<boolean> {
    return this.storage.get(Settings.OFFLINE_MODE_ENABLED).then(result => { return result === true });
  }

  setRealtimeSendEnabled(enabled: boolean) {
    return this.storage.set(Settings.ENABLE_REALTIME_SEND, enabled);
  }
  getRealtimeSendEnabled(): Promise<boolean> {
    return this.storage.get(Settings.ENABLE_REALTIME_SEND).then(result => {
      if (result === true || result === false) {
        return result;
      } else {
        return true;
      }
    });
  }
}
