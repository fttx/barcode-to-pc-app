import { Component } from '@angular/core';
import { Device } from '@ionic-native/device';
import { NavController, ViewController, Platform, Events } from 'ionic-angular';

import { barcodeFormatModel } from '../../models/barcode-format.model';
import { requestModelHelo } from '../../models/request.model';
import { ServerProvider } from '../../providers/server';
import { SelectScanningModePage } from '../scan-session/select-scanning-mode/select-scanning-mode';
import { Config } from './../../providers/config';
import { Settings } from './../../providers/settings';
import { AppVersion } from '@ionic-native/app-version';
import { Insomnia } from '@ionic-native/insomnia';
import { Utils } from '../../providers/utils';
import { TranslateService } from '@ngx-translate/core';

/*
  Generated class for the Settings page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-settings',
  templateUrl: 'settings.html'
})
export class SettingsPage {
  public deviceName: string;
  public scanSessionName: string;
  public pdaIntents: string;
  public scanSessionFilter: string;
  public continueModeTimeout = Config.DEFAULT_CONTINUE_MODE_TIMEOUT;
  public repeatInterval = Config.DEFAULT_REPEAT_INVERVAL;
  public availableContinueModeTimeouts = Array.from(Array(30).keys());
  public availableRepeatIntervals = [];
  public scanMode = '';
  public duplicateBarcodeChoice: 'ask' | 'always_accept' | 'discard_adjacent' | 'discard_scan_session';
  public alwaysUseDefaultScanSessionName = false;
  public alwaysUseCameraForScanSessionName = false;
  public preferFrontCamera = false;
  public preferWideLens = false;
  public torchOn = false;
  public keepDisplayOn = false;
  public enableBeep = true;
  public alsoInverted = false;
  public enableNFC = true;
  public disableKeyboarAutofocus = true;
  public skipWifiCheck = false;
  public enableVibrationFeedback = true;
  public disableSpecialCharacters = false;
  public openScanOnStart = false;
  public allowOutputTemplateSelection = true;
  private changesSaved = false;
  public quantityType: string = 'number'; // deprecated

  public barcodeFormats: barcodeFormatModel[] = barcodeFormatModel.supportedBarcodeFormats
  public enableLimitBarcodeFormats: boolean = false;
  public enableRealtimeSend: boolean = true;

  public static SCAN_MODE_LABELS: any = {};
  public static DUPLICATE_BARCODE_LABELS: any = {};

  constructor(
    public viewCtrl: ViewController,
    public navCtrl: NavController,
    public settings: Settings,
    private serverProvider: ServerProvider,
    public appVersion: AppVersion,
    private device: Device,
    public platform: Platform, // required from the template
    private insomnia: Insomnia,
    private translateService: TranslateService,
    public events: Events,
  ) {
    for (let i = 0; i <= 15000; i += 250) {
      this.availableRepeatIntervals.push(i);
    }

    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_ASK] = '';
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_CONTINUE] = '';
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_SINGLE] = '';
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY] = '';

    SettingsPage.DUPLICATE_BARCODE_LABELS['ask'] = '';
    SettingsPage.DUPLICATE_BARCODE_LABELS['always_accept'] = '';
    SettingsPage.DUPLICATE_BARCODE_LABELS['discard_adjacent'] = '';
    SettingsPage.DUPLICATE_BARCODE_LABELS['discard_scan_session'] = '';
  }

  async ngOnInit() {
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_ASK] = this.translateService.instant('askEveryTimeLabel');
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_CONTINUE] = this.translateService.instant('continuousModeLabel');
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_SINGLE] = this.translateService.instant('singleModeLabel');
    SettingsPage.SCAN_MODE_LABELS[SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY] = this.translateService.instant('enterManuallyLabel');

    SettingsPage.DUPLICATE_BARCODE_LABELS['ask'] = this.translateService.instant('askLabel');
    SettingsPage.DUPLICATE_BARCODE_LABELS['always_accept'] = this.translateService.instant('acceptLabel');
    SettingsPage.DUPLICATE_BARCODE_LABELS['discard_adjacent'] = this.translateService.instant('discardAdjacentLabel');
    SettingsPage.DUPLICATE_BARCODE_LABELS['discard_scan_session'] = this.translateService.instant('discardSessionLabel');
  }

  ionViewDidLoad() {
    this.settings.getContinueModeTimeout().then(seconds => {
      if (seconds) {
        this.continueModeTimeout = seconds;
      }
    })

    this.settings.getDefaultMode().then(scanMode => {
      if (scanMode) {
        this.scanMode = scanMode;
      }
    })

    this.settings.getDuplicateBarcodeChoice().then(duplicateBarcodeChoice => {
      if (duplicateBarcodeChoice) {
        this.duplicateBarcodeChoice = duplicateBarcodeChoice;
      }
    })

    this.settings.getDeviceName().then(deviceName => {
      this.deviceName = deviceName;
    })

    this.settings.getScanSessionName().then(scanSessionName => {
      this.scanSessionName = scanSessionName;
    })

    this.settings.getPDAIntents().then(pdaIntents => {
      this.pdaIntents = pdaIntents;
    })

    this.settings.getScanSessionFilter().then(scanSessionFilter => {
      this.scanSessionFilter = scanSessionFilter;
    })

    this.settings.getRepeatInterval().then(repeatInterval => {
      if (repeatInterval != null) {
        this.repeatInterval = repeatInterval;
      }
    })

    this.settings.getBarcodeFormats().then(barcodeFormats => {
      this.barcodeFormats = barcodeFormats;
    })

    this.settings.getEnableLimitBarcodeFormats().then(enableLimitBarcodeFormats => {
      this.enableLimitBarcodeFormats = enableLimitBarcodeFormats;
    })

    this.settings.getRealtimeSendEnabled().then(enableRealtimeSend => {
      this.enableRealtimeSend = enableRealtimeSend;
    });

    this.settings.getAlwaysUseDefaultScanSessionName().then(alwaysUseDefaultScanSessionName => {
      this.alwaysUseDefaultScanSessionName = alwaysUseDefaultScanSessionName;
    });

    this.settings.getAlwaysUseCameraForScanSessionName().then(alwaysUseCameraForScanSessionName => {
      this.alwaysUseCameraForScanSessionName = alwaysUseCameraForScanSessionName;
    });

    this.settings.getPreferFrontCamera().then(preferFrontCamera => {
      this.preferFrontCamera = preferFrontCamera;
    });

    this.settings.getPreferWideLens().then(preferWideLens => {
      this.preferWideLens = preferWideLens;
    });

    this.settings.getTorchOn().then(torchOn => {
      this.torchOn = torchOn;
    });

    this.settings.getKeepDisplayOn().then(keepDisplayOn => {
      this.keepDisplayOn = keepDisplayOn;
    });

    this.settings.getEnableBeep().then(enableBeep => {
      this.enableBeep = enableBeep;
    });

    this.settings.getAlsoInverted().then(alsoInverted => {
      this.alsoInverted = alsoInverted;
    });

    this.settings.getEnableNFC().then(enableNFC => {
      this.enableNFC = enableNFC;
    });

    this.settings.getDisableKeyboarAutofocus().then(disableKeyboarAutofocus => {
      this.disableKeyboarAutofocus = disableKeyboarAutofocus;
    });

    this.settings.getSkipWiFiCheck().then(skipWifiCheck => {
      this.skipWifiCheck = skipWifiCheck;
    });

    this.settings.getEnableVibrationFeedback().then(enableVibrationFeedback => {
      this.enableVibrationFeedback = enableVibrationFeedback;
    });

    this.settings.getDisableSpecialCharacters().then(disableSpecialCharacters => {
      this.disableSpecialCharacters = disableSpecialCharacters;
    });

    this.settings.getOpenScanOnStart().then(openScanOnStart => {
      this.openScanOnStart = openScanOnStart;
    });

    this.settings.getAllowOutputTemplateSelection().then(allowOutputTemplateSelection => {
      this.allowOutputTemplateSelection = allowOutputTemplateSelection;
    });

    /**
     * @deprecated For backwards compatibility, for the user who still have a
     * QUANTITY component in the Output template.
     * We still need to maintain the settings they chose in the beginning.
     * Do not remove!
     */
    this.settings.getQuantityType().then(quantityType => {
      if (quantityType) {
        this.quantityType = quantityType;
      }
    });
  }

  ionViewWillLeave() {
    if (!this.changesSaved) {
      this.saveChanges();
    }
  }

  dismissClick() {
    this.changesSaved = true;
    this.saveChanges();
    this.events.publish('settings:save');
    this.viewCtrl.dismiss();
  }

  async saveChanges() {
    this.settings.setContinueModeTimeout(this.continueModeTimeout);
    this.settings.setRepeatInterval(this.repeatInterval);
    this.settings.setDefaultMode(this.scanMode);
    this.settings.setDuplicateBarcodeChoice(this.duplicateBarcodeChoice);
    this.settings.setDeviceName(this.deviceName);
    this.settings.setScanSessionName(this.scanSessionName);
    this.settings.setPDAIntents(this.pdaIntents);
    this.settings.setScanSessionFilter(this.scanSessionFilter);
    this.settings.setAlwaysUseDefaultScanSessionName(this.alwaysUseDefaultScanSessionName);
    this.settings.setAlwaysUseCameraForScanSessionName(this.alwaysUseCameraForScanSessionName);
    this.settings.setPreferFrontCamera(this.preferFrontCamera);
    this.settings.setPreferWideLens(this.preferWideLens);
    this.settings.setTorchOn(this.torchOn);
    this.settings.setKeepDisplayOn(this.keepDisplayOn);
    this.settings.setEnableBeep(this.enableBeep);
    this.settings.setAlsoInverted(this.alsoInverted);
    this.settings.setEnableNFC(this.enableNFC);
    this.settings.setDisableKeyboarAutofocus(this.disableKeyboarAutofocus);
    this.settings.setSkipWiFiCheck(this.skipWifiCheck);
    this.settings.setEnableVibrationFeedback(this.enableVibrationFeedback);
    this.settings.setDisableSpecialCharacters(this.disableSpecialCharacters);
    this.settings.setOpenScanOnStart(this.openScanOnStart);
    this.settings.setAllowOutputTemplateSelection(this.allowOutputTemplateSelection);
    this.settings.setBarcodeFormats(this.barcodeFormats);
    this.settings.setEnableLimitBarcodeFormats(this.enableLimitBarcodeFormats);
    this.settings.setRealtimeSendEnabled(this.enableRealtimeSend);
    this.settings.setQuantityType(this.quantityType);

    if (this.keepDisplayOn) {
      this.insomnia.keepAwake();
    } else {
      this.insomnia.allowSleepAgain()
    }

    this.serverProvider.send(new requestModelHelo().fromObject({
      version: await this.appVersion.getVersionNumber(),
      deviceName: this.deviceName,
      deviceId: this.device.uuid
    }));

    // let toast = this.toastCtrl.create({
    //   message: 'Settings saved',
    //   duration: 2000,
    //   position: 'bottom'
    // });
    // toast.present();
  }

  public getScanModeList() {
    return [
      SelectScanningModePage.SCAN_MODE_ASK,
      SelectScanningModePage.SCAN_MODE_CONTINUE,
      SelectScanningModePage.SCAN_MODE_SINGLE,
      SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY,
    ]
  }

  public getScanModeName(scanMode: string) {
    return SettingsPage.SCAN_MODE_LABELS[scanMode];
  }

  public duplicateBarcodeChoiceName(choice: ('ask' | 'always_accept' | 'discard_adjacent' | 'discard_scan_session')) {
    return SettingsPage.DUPLICATE_BARCODE_LABELS[choice];
  }
}
