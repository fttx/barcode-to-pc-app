import { Injectable, NgZone } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions, BarcodeScanResult } from '@fttx/barcode-scanner';
import { FirebaseAnalytics } from '@ionic-native/firebase-analytics';
import { NativeAudio } from '@ionic-native/native-audio';
import { Alert, AlertController, Events, Platform } from 'ionic-angular';
import { AlertInputOptions } from 'ionic-angular/components/alert/alert-options';
import { Observable, Subscriber, Subscription } from 'rxjs';
import { lt, SemVer } from 'semver';
import * as Supplant from 'supplant';
import { KeyboardInputComponent } from '../components/keyboard-input/keyboard-input';
import { OutputBlockModel } from '../models/output-block.model';
import { OutputProfileModel } from '../models/output-profile.model';
import { requestModelRemoteComponent, requestModelUndoInfiniteLoop } from '../models/request.model';
import { responseModel, responseModelRemoteComponentResponse, responseModelUpdateSettings } from '../models/response.model';
import { ScanModel } from '../models/scan.model';
import { SelectScanningModePage } from '../pages/scan-session/select-scanning-mode/select-scanning-mode';
import { Config } from './config';
import { ServerProvider } from './server';
import { Settings } from './settings';
import { Utils } from './utils';

/**
 * The job of this class is to generate a ScanModel by talking with the native
 * barcode scanner plugin and/or by asking the user the required data to fill
 * the data of the selected OutputProfile.
 *
 * The only public method is scan
 */
@Injectable()
export class ScanProvider {
  // Used to restore the focus of the Keyboard input field from the ScanSession page
  public awaitingForBarcode: boolean;

  private pluginOptions: BarcodeScannerOptions

  // This parameter is different from SelectScanningModePage.SCAN_MODE_* but
  // it kinds of extends it.
  // The SCAN_MODE_* is more related to the UI, so what the user is able to
  // choose, while the acquisitionMode is how actually the barcode acquisition
  // is performed.
  // This separation is required in order to allow the mixed_continue when
  // there is a number parameter or when the native plugin doesn't support
  // the continue mode.
  public acqusitionMode: 'manual' | 'single' | 'mixed_continue' | 'continue' = 'manual';
  private barcodeFormats: any[];
  private outputProfile: OutputProfileModel;
  private outputProfileIndex: number;
  private deviceName: string;
  private settingsUpdatedDialog: Alert = null;
  /**
   * @deprecated see src/pages/settings/settings.ts/ionViewDidLoad()/getQuantityType()
   */
  private quantityType: 'number' | 'text';
  private keyboardInput: KeyboardInputComponent;

  private remoteComponentErrorDialog: Alert = null;

  public static INFINITE_LOOP_DETECT_THRESHOLD = 30;

  constructor(
    private alertCtrl: AlertController,
    private barcodeScanner: BarcodeScanner,
    private platform: Platform,
    private ngZone: NgZone,
    private firebaseAnalytics: FirebaseAnalytics,
    public nativeAudio: NativeAudio,
    private settings: Settings,
    public serverProvider: ServerProvider,
    public events: Events,
  ) {
    this.events.subscribe(responseModel.ACTION_UPDATE_SETTINGS, (responseModelUpdateSettings: responseModelUpdateSettings) => {
      this.outputProfile = responseModelUpdateSettings.outputProfiles[this.outputProfileIndex];
      if (this.settingsUpdatedDialog != null) this.settingsUpdatedDialog.dismiss();
      this.settingsUpdatedDialog = this.alertCtrl.create({
        title: 'Settings updated',
        message: 'The server settings have been updated. To apply the changes also to the app side tap on the camera button.',
        buttons: ['Ok'],
      });
      this.settingsUpdatedDialog.present();
    });
  }

  private lastObserver: Subscriber<ScanModel> = null;
  private _scanCallId: number = null; // used to prevent scan(), and thus again() calls overlaps

  /**
   * It returns an Observable that will output a ScanModel everytime the
   * current OutputProfile is completed.
   *
   * Whenever the scan process ends or is interrupted, it will send
   * an "complete" event
   *
   * @param scanMode SCAN_MODE_CONTINUE, SCAN_MODE_SINGLE or SCAN_MODE_MANUAL
   * @param outputProfileIndex by default there is only one OutputProfile
   * @param scanSession is required to inject the scanSession.name as variable
   * @param keyboardInput element for manual acquisition
   */
  scan(scanMode, outputProfileIndex, scanSession, keyboardInput: KeyboardInputComponent): Observable<ScanModel> {
    // prevent memory leak
    if (this.lastObserver) {
      this.lastObserver.complete();
    }
    this._scanCallId = new Date().getTime();

    this.keyboardInput = keyboardInput;
    this.outputProfileIndex = outputProfileIndex;

    return new Observable(observer => {
      this.lastObserver = observer;
      Promise.all([
        this.settings.getPreferFrontCamera(), // 0
        this.settings.getEnableLimitBarcodeFormats(), // 1
        this.settings.getBarcodeFormats(), // 2
        this.settings.getQuantityType(), // 3
        this.settings.getContinueModeTimeout(), // 4
        this.settings.getDeviceName(), // 5
        this.getOutputProfile(outputProfileIndex), //6
        this.settings.getTorchOn(), // 7
        this.settings.getEnableBeep(), // 8
        this.settings.getEnableVibrationFeedback(), // 9
      ]).then(async result => {
        // parameters
        let preferFrontCamera = result[0];
        let enableLimitBarcodeFormats = result[1];
        this.barcodeFormats = result[2];
        let quantityType = result[3];
        let continueModeTimeout = result[4];
        this.deviceName = result[5];
        this.outputProfile = result[6];
        let torchOn = result[7];
        let enableBeep = result[8];
        let enableVibrationFeedback = result[9];
        const blockingComponents = OutputProfileModel.ContainsBlockingComponents(this.outputProfile);
        // const containsMixedBarcodeFormats = OutputProfileModel.ContainsMixedBarcodeFormats(this.outputProfile);
        const containsMultipleBarcodeFormats = OutputProfileModel.ContainsMultipleBarcodeFormats(this.outputProfile);

        // other computed parameters
        if (quantityType && quantityType == 'text') {
          // trick to avoid type checking
          // quantityType is deprecated
          this.quantityType = 'text'
        } else {
          this.quantityType = 'number';
        }
        switch (scanMode) {
          case SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY: this.acqusitionMode = 'manual'; break;
          case SelectScanningModePage.SCAN_MODE_SINGLE: this.acqusitionMode = 'single'; break;
          case SelectScanningModePage.SCAN_MODE_CONTINUE: {
            this.acqusitionMode = 'continue';
            if (blockingComponents || !this.platform.is('android') || continueModeTimeout || containsMultipleBarcodeFormats) {
              // Note: we force mixed_continue also when there are mutliple barcodes to allow the Label to be update
              // containsMixedBarcodeFormats will scan ok, but the user won't have much feedback, and the label
              // won't update
              this.acqusitionMode = 'mixed_continue';
            }
            break;
          }
        }

        // These options are require from the native plugin
        // We init them here, but they can change while the Output template is
        // beign executed, in particular the BARCODE component can override the
        // appPluginOptions.formats property
        let initialPluginOptions: BarcodeScannerOptions = {
          showFlipCameraButton: true,
          prompt: Config.DEFAULT_ACQUISITION_LABEL, // supported on Android only
          showTorchButton: true,
          preferFrontCamera: preferFrontCamera,
          torchOn: torchOn,
          continuousMode: this.acqusitionMode == 'continue',
          disableSuccessBeep: !enableBeep,
          vibrationFeedback: enableVibrationFeedback,
          resultDisplayDuration: 0
        };
        if (enableLimitBarcodeFormats) {
          // set the barcode formats from the app settings
          initialPluginOptions.formats = this.barcodeFormats.filter(barcodeFormat => barcodeFormat.enabled).map(barcodeFormat => barcodeFormat.name).join(',');
        }
        this.pluginOptions = initialPluginOptions;

        // used to prevent infinite loops.
        let resetAgainCountTimer;
        let againCount = 0;
        let prevScanDisplayValue = '';

        // used to prevent scan(), and thus again() calls overlaps
        let _scanCallId = this._scanCallId;

        // again() encapsulates the part that need to be repeated when
        // the continuos mode or manual mode are active
        let again = async () => {

          // cancel the previus outputProfile exection. (needed for continue mode?)
          if (_scanCallId != this._scanCallId) {
            observer.complete()
            return;
          }

          // infinite loop detetion
          if (againCount > ScanProvider.INFINITE_LOOP_DETECT_THRESHOLD) {
            // Example of infinite loop:
            //
            // Output template = [IF(false)] [BARCODE] [ENDIF]
            // In this case it would repeat  the outputProfile
            // indefinitelly without prompting the user because there
            // isn't a blocking component that can give the opportunity
            // to press back and cancel the scan.
            // It may happen also when there is no BARCODE component or
            // when the if contains a syntax error.
            let wantToContinue = await this.showPreventInfiniteLoopDialog();
            if (!wantToContinue) {
              // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
              observer.complete();
              return; // returns the again() function
            }
          }

          // scan result
          let scan = new ScanModel();
          let now = new Date().getTime();
          // cloning the the outputProfile object is important since the if/endif
          // blocks may remove elements
          scan.outputBlocks = JSON.parse(JSON.stringify(this.outputProfile.outputBlocks))
          scan.id = now;
          scan.repeated = false;
          scan.date = now;

          // variables that can be used in the Output Components
          let variables = {
            barcode: '',
            // barcodes: [],
            quantity: null, // deprecated
            number: null,
            text: null,
            timestamp: (scan.date * 1000),
            date: new Date(scan.date).toLocaleDateString(),
            time: new Date(scan.date).toLocaleTimeString(),
            scan_session_name: scanSession.name,
            device_name: this.deviceName,
            select_option: null,
            http: null,
            run: null,
            csv_lookup: null,
          }

          // run the OutputProfile
          for (let i = 0; i < scan.outputBlocks.length; i++) {
            let outputBlock = scan.outputBlocks[i];

            // Inject variables in label
            if (outputBlock.label) outputBlock.label = new Supplant().text(outputBlock.label, variables);

            switch (outputBlock.type) {
              // some components like 'key' and 'text', do not need any processing from the
              // app side, so we just skip them
              case 'key': break;
              case 'text': break;
              // while other components like 'variable' need to be filled with data, that is
              // acquired from the smartphone
              case 'variable': {
                switch (outputBlock.value) {
                  case 'deviceName': outputBlock.value = this.deviceName; break;
                  case 'timestamp': outputBlock.value = (scan.date * 1000) + ''; break;
                  case 'date': outputBlock.value = new Date(scan.date).toLocaleDateString(); break;
                  case 'time': outputBlock.value = new Date(scan.date).toLocaleTimeString(); break;
                  case 'date_time': outputBlock.value = new Date(scan.date).toLocaleTimeString() + ' ' + new Date(scan.date).toLocaleDateString(); break;
                  case 'scan_session_name': outputBlock.value = scanSession.name; break;
                  case 'quantity': // deprecated
                  case 'number': {
                    try {
                      outputBlock.value = await this.getField(outputBlock.label, 'number', outputBlock.defaultValue, outputBlock.filter, outputBlock.errorMessage);
                    } catch (err) {
                      // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
                      observer.complete();
                      return; // returns the again() function
                    }
                    // it's ok to always include the number variable, since even if the user
                    // doesn't have the license he won't be able to create the output profile
                    variables.number = outputBlock.value;
                    variables.quantity = outputBlock.value; // deprecated, backwards compatibility
                    scan.quantity = outputBlock.value; // backwards compatibility
                    break;
                  }
                  case 'text': {
                    try {
                      outputBlock.value = await this.getField(outputBlock.label, 'text', outputBlock.defaultValue, outputBlock.filter, outputBlock.errorMessage);
                    } catch (err) {
                      // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
                      observer.complete();
                      return; // returns the again() function
                    }
                    variables.text = outputBlock.value;
                    break;
                  }
                } // switch outputBlock.value
                break;
              }
              case 'select_option': {
                outputBlock.value = new Supplant().text(outputBlock.value, variables);
                outputBlock.value = await this.showSelectOption(outputBlock.value);
                variables.select_option = outputBlock.value;
                break;
              }
              case 'function': {
                try {
                  outputBlock.value = this.evalCode(outputBlock.value, variables);
                } catch (error) {
                  outputBlock.value = '';
                }
                break;
              }
              case 'barcode': {
                try {
                  // Prepare the label for an eventual barcode acqusition
                  this.pluginOptions.prompt = outputBlock.label || Config.DEFAULT_ACQUISITION_LABEL;
                  this.keyboardInput.setError(false);

                  if (outputBlock.enabledFormats && outputBlock.enabledFormats.length != 0) {
                    this.pluginOptions.formats = outputBlock.enabledFormats.join(',')
                  } else {
                    // since the this.pluginOptions.formats variable can be dirty from
                    // the previous iteration, we must reset it to the initial value.
                    this.pluginOptions.formats = initialPluginOptions.formats;
                  }

                  let barcode = await this.getBarcode(outputBlock.label, outputBlock.filter, outputBlock.errorMessage);

                  // Context:
                  //
                  // Since we don't know if the user wants to start a new scan() or if he/she wants
                  // to add more scannings, we always call again() wich will get stuck in the Promise
                  // of the line above that waits for a text input (or camera acquisition).
                  //
                  // If the user starts a new scan() and thus an new OutputProfile executuion
                  // (by clicking the FAB), we have to drop the barcode that will acquired from
                  // the stuck again(), and also call return; to prevent other components to be exceuted.
                  //
                  // The same thing could happen with await getNumberField() and await getSelectOption()
                  // but since there isn't a way to press the FAB button and create a new scan() without
                  // closing the alert, they won't never get stuck.
                  if (_scanCallId != this._scanCallId) {
                    observer.complete()
                    return;
                  }

                  delete outputBlock['enabledFormats'];
                  delete outputBlock['filter'];
                  delete outputBlock['errorMessage'];
                  variables.barcode = barcode;
                  // variables.barcodes.push(barcode);
                  outputBlock.value = barcode;
                } catch (err) {
                  // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
                  observer.complete();
                  return; // returns the again() function
                }
              }
              case 'delay': break;
              case 'http':
              case 'run':
              case 'csv_lookup': {
                // Injects variables (interpolation)
                // Example: 'http://localhost/?a={{ barcode }}' becomes 'http://localhost/?a=123456789'
                outputBlock.value = new Supplant().text(outputBlock.value, variables);

                // If the app isn't connected we can't execute the remote component
                if (!this.serverProvider.isConnected()) {
                  outputBlock.value = outputBlock.notFoundValue;
                  break;
                }

                // For older versions of the server we break here.
                // The RUN value will be adjusted later with the PUT_SCAN_ACK response
                if (this.serverProvider.serverVersion != null && lt(this.serverProvider.serverVersion, new SemVer('3.12.0'))) break;

                this.keyboardInput.lock('Executing ' + outputBlock.name.toUpperCase() + ', please wait...');

                try {
                  let newOutputBlock = await this.remoteComponent(outputBlock);
                  this.keyboardInput.unlock();
                  // For some reason the assigment isn't working (UI doesn't update)
                  Object.assign(outputBlock, newOutputBlock);
                  variables[outputBlock.type] = outputBlock.value;
                } catch {
                  this.keyboardInput.unlock();
                  // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
                  observer.complete();
                  return; // returns the again() function
                }
                break;
              }
              case 'beep': {
                // this code is duplicated on the server side for the TEST AUDIO button (settings.html)
                let beepSpeed;
                switch (outputBlock.beepSpeed) {
                  case 'low': beepSpeed = 700; break;
                  case 'medium': beepSpeed = 450; break;
                  case 'fast': beepSpeed = 250; break;
                }
                let beep = () => {
                  return new Promise((resolve, reject) => {
                    this.nativeAudio.play(outputBlock.value);
                    setTimeout(() => { resolve() }, beepSpeed);
                  });
                };
                for (let i = 0; i < outputBlock.beepsNumber; i++) { await beep(); }
                break;
              }
              case 'if': {
                let condition = false;
                try {
                  condition = this.evalCode(outputBlock.value, variables);
                } catch (error) {
                  // if the condition cannot be evaluated we must stop
                  // TODO stop only if the acusitionMode is manual? Or pop-back?

                  // this code fragment is duplicated for the 'number', 'text', 'if' and 'barcode' blocks. It's also present in the againCount condition, and in the remoteComponent() method.
                  observer.complete();
                  return; // returns the again() function
                }
                // the current i value is pointing to the 'if' block, we start searching from
                // the next block, that is the (i + 1)th
                let endIfIndex = OutputBlockModel.FindEndIfIndex(scan.outputBlocks, i + 1);
                if (condition == true) {
                  // if the condition is true we remove only the 'if' and 'endif' bloks

                  // remove 'if'
                  scan.outputBlocks.splice(i, 1);

                  // remove 'endif'
                  // since we removed 1 block, now we have to add -1 offset in order
                  // to remove the 'endif'
                  scan.outputBlocks.splice(endIfIndex - 1, 1);
                } else {
                  // if the condition is false, we must branch, so we remove the blocks
                  // inside the 'if' (including the current block that is an 'if') and the 'endif'
                  // splice(startFrom (included), noElementsToRemove (included))
                  let count = endIfIndex - i + 1;
                  scan.outputBlocks.splice(i, count);
                }
                // since we always remove the 'if' block, we won't need to point to the next
                // block, because the latter will take the place of the current 'if' block.
                // To do that we just decrease i, in order to compensate the increment performed
                // by the for cycle
                i--;
                break;
              }

            } // switch outputBlock.type
          } // for

          /**
          * @deprecated backwards compatibility
          */
          scan.text = scan.outputBlocks.map(outputBlock => {
            if (outputBlock.type == 'barcode') {
              return outputBlock.value;
            } else {
              return '';
            }
          }).filter(x => x != '').join(' ');
          // end backwards compatibility

          scan.displayValue = ScanModel.ToString(scan);

          // prevent infinite loops
          if (scan.displayValue == prevScanDisplayValue) {
            againCount++;
          }
          prevScanDisplayValue = scan.displayValue;
          if (resetAgainCountTimer) clearTimeout(resetAgainCountTimer);
          resetAgainCountTimer = setTimeout(() => againCount = 0, 500);

          observer.next(scan);

          // decide how and if repeat the outputBlock
          switch (this.acqusitionMode) {
            case 'continue':
              again();
              break;
            case 'mixed_continue':
              this.showAddMoreDialog(continueModeTimeout).then((addMore) => {
                if (addMore) {
                  again(); // if the user clicks yes => loop
                } else {
                  observer.complete();
                }
              })
              break;
            case 'manual':
              again();
              break;
            case 'single':
              observer.complete();
              break;
            default:
              observer.complete();
              break;
          } // switch
        } // again function
        again(); // starts the loop for the first time
      });
    })
  }

  // We need to store lastResolve and lastReject because when the continuos
  // mode is in use, we have to forward the resulting barcode of the
  // subscription to the last getBarcode promise.
  // lastReject and lastResolve relay on the fact that it will never be
  // simultanius calls to getBarcode() method, it will always be called
  // sequencially. The explaination is that the loop contained in the scan()
  // method isn't allowed to go haed until the previus getBarcode doesn't get
  // resolved.
  private lastResolve;
  private lastReject;
  private continuosScanSubscription: Subscription = null;

  private getBarcode(label = null, filter = null, errorMessage = null): Promise<string> {
    this.awaitingForBarcode = true;

    let promise = new Promise<string>((resolve, reject) => {
      let again = async (showError = false) => {
        if (showError && errorMessage) {
          this.pluginOptions.prompt = 'Error: ' + errorMessage;
        }
        switch (this.acqusitionMode) {
          case 'single':
          case 'mixed_continue': {
            let barcodeScanResult: BarcodeScanResult = await this.barcodeScanner.scan(this.pluginOptions).first().toPromise();
            if (!barcodeScanResult || barcodeScanResult.cancelled) {
              reject('cancelled');
              return;
            }
            // CODE_39 fix (there is a copy of this fix in the CONTINUE mode part, if you change this then you have to change also the other one )
            if (barcodeScanResult.text && barcodeScanResult.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
              barcodeScanResult.text = Utils.convertCode39ToCode32(barcodeScanResult.text);
            }
            // END CODE_39 fix
            if (filter != null && !barcodeScanResult.text.match(filter)) {
              again(true);
              return;
            } else {
              resolve(barcodeScanResult.text);
            }
            break;
          }
          // It's used only if there aren't dialog components and the user
          // selected the continuos mode. The only way to exit is to press cancel.
          //
          // Practically getBarcodes is called indefinitelly until it
          // doesn't reject() the returned promise (cancel press).
          //
          // Since the exit condition is inside this method, we just
          // accumulate barcodes indefinitely, they will always be
          // consumed from the caller.
          case 'continue': {
            this.lastResolve = resolve;
            this.lastReject = reject;

            if (this.continuosScanSubscription == null) {
              this.continuosScanSubscription = this.barcodeScanner.scan(this.pluginOptions).subscribe(barcodeScanResult => {
                if (!barcodeScanResult || barcodeScanResult.cancelled) {
                  this.continuosScanSubscription.unsubscribe();
                  this.continuosScanSubscription = null;
                  this.lastReject();
                  return; // returns the promise executor function
                }

                // CODE_39 fix (there is a copy of this fix in the SINGLE mode part, if you change this then you have to change also the other one )
                if (barcodeScanResult.text && barcodeScanResult.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
                  barcodeScanResult.text = Utils.convertCode39ToCode32(barcodeScanResult.text);
                }
                // END CODE_39 fix

                if (filter == null || (filter != null && barcodeScanResult.text.match(filter))) {
                  this.lastResolve(barcodeScanResult.text);
                }
              }, error => {
                // this should never be called
              }, () => {
                // this should never be called
              })
            }
            break;
          }

          case 'manual': {
            this.keyboardInput.focus(true);
            this.keyboardInput.setPlaceholder(label);
            if (showError && errorMessage) this.keyboardInput.setError(errorMessage);
            // here we don't wrap the promise inside a try/catch statement because there
            // isn't a way to cancel a manual barcode acquisition
            let barcode = await this.keyboardInput.onSubmit.first().toPromise();
            if (filter != null && !barcode.match(filter)) {
              again(true);
              return;
            } else {
              resolve(barcode);
            }
            break;
          }
        } // switch acqusitionMode
      }; // again
      again();
    }); // promise

    promise
      .then(value => { this.awaitingForBarcode = false; })
      .catch(err => { this.awaitingForBarcode = false; })
    return promise;
  }

  // getOutputProfile() is called in two separated places, that's why is
  // separated from the updateOutputProfile() method.
  private async getOutputProfile(i): Promise<OutputProfileModel> {
    let profiles = await this.settings.getOutputProfiles();
    return new Promise<OutputProfileModel>((resolve, reject) => {
      // Prevent OutOfBounds. The same logic is duplciated in the SelectScanningModePage/ionViewWillEnter() method
      if (i >= profiles.length) i = profiles.length - 1;
      if (i < 0) i = 0;
      resolve(profiles[i]);
    });
  }

  private showSelectOption(csvSelectOptions: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let options = csvSelectOptions.split(',');
      let optionIndex = 0;
      let inputs: AlertInputOptions[] = options.map(option => {
        let input: AlertInputOptions = {
          type: 'radio',
          label: option,
          value: option,
        };
        if (optionIndex == 0) {
          input.checked = true;
        }
        optionIndex++;
        return input;
      });

      let alert = this.alertCtrl.create({
        title: 'Select an option',
        inputs: inputs,
        enableBackdropDismiss: false,
        buttons: [{
          text: 'Ok',
          handler: (data: any) => {
            resolve(data);
          }
        }]
      });
      alert.setLeavingOpts({ keyboardClose: false, animate: false });
      alert.present({ keyboardClose: false, animate: false });
    });
  }

  /**
   * Shows a dialog to acquire a value that can be number or text
   */
  private getField(label = null, fieldType: ('text' | 'number') = 'number', defaultValue: string = null, filter = null, errorMessage = null): Promise<string> { // doesn't need to be async becouse doesn't contain awaits
    if (label == null) {
      if (fieldType == 'number') {
        label = 'Insert a number';
      } else {
        label = 'Insert text'
      }
    }
    return new Promise((resolve, reject) => {
      let again = (showError = false) => {
        // quantityType is deprecated, it's always 'number' in the newest versions,
        // but we still keep it for backwards compatibility
        if (this.quantityType && fieldType == 'number') {
          fieldType = this.quantityType;
        }

        // NUMBER defaultValue is never null
        let placeholder = `(Default is ${defaultValue} press OK to insert it)`;
        if (defaultValue == null) placeholder = 'Eg. damaged item';

        let alert = this.alertCtrl.create({
          title: label,
          message: showError ? errorMessage : null,
          enableBackdropDismiss: false,
          cssClass: this.platform.is('android') ? 'alert-get-field alert-big-buttons' : null,
          inputs: [{ name: 'value', type: fieldType, placeholder: placeholder }],
          buttons: [{
            role: 'cancel', text: 'Cancel',
            handler: () => { reject('cancelled'); },
            cssClass: this.platform.is('android') ? 'button-outline-md' : null,
          }, {
            text: 'Ok',
            handler: data => {
              if (data.value) { // && isNumber(data.value)
                if (filter != null && !data.value.match(filter)) {
                  setTimeout(() => { again(true); }, 500);
                  return;
                }
                resolve(data.value);
              } else {
                resolve(defaultValue || '');
              }
            },
            cssClass: this.platform.is('android') ? 'button-outline-md button-ok' : null,
          }]
        });
        alert.setLeavingOpts({ keyboardClose: false, animate: false });
        alert.present({ keyboardClose: false, animate: false });
      };
      again();
    });
  }

  private remoteComponent(outputBlock: OutputBlockModel): Promise<OutputBlockModel> {
    return new Promise((resolve, reject) => {
      if (!this.serverProvider.isConnected()) {
        this.alertCtrl.create({
          title: 'Execution error',
          message: 'Cannot execute the ' + outputBlock.type.toUpperCase() + ' component.<br><br>\
                    Please make sure that the smartphone is connected to the server',
          buttons: [{ text: 'Ok', handler: () => { } }]
        }).present();
        reject();
        return;
      }

      // Generate an unique request id
      let id = new Date().getTime();
      let wsRequest = new requestModelRemoteComponent().fromObject({ id: id, outputBlock: outputBlock });

      // Before sending the request, start listening fo the upcoming ACK response
      let ackSubscription = this.serverProvider.onMessage().subscribe(message => {
        if (message.action == responseModel.ACTION_REMOTE_COMPONENT_RESPONSE) {
          let response: responseModelRemoteComponentResponse = message;

          // Listen only for responses directed to this request
          if (id == response.id) {

            if (response.errorMessage == null) {
              // Success
              ackSubscription.unsubscribe();
              resolve(response.outputBlock);
            } else {
              // Error
              if (this.remoteComponentErrorDialog != null) this.remoteComponentErrorDialog.dismiss();
              this.remoteComponentErrorDialog = this.alertCtrl.create({
                title: 'Error',
                message: response.errorMessage,
                buttons: [{ text: 'OK', handler: () => { resolve(response.outputBlock); } }],
              });
              reject();
              // Present the dialog only after the rejection, so that it'll be on top
              // of other eventual dialogs
              this.remoteComponentErrorDialog.present();
            }
          }
        }
      });

      // Send the remote component execution command to the server
      this.serverProvider.send(wsRequest);
    });
  }

  private showAddMoreDialog(timeoutSeconds): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let interval = null;
      let alert = this.alertCtrl.create({
        title: 'Continue scanning?',
        message: 'Do you want to add another item to this scan session?',
        buttons: [{
          text: 'Stop', role: 'cancel',
          handler: () => {
            if (interval) clearInterval(interval);
            resolve(false);
          }
        }, {
          text: 'Continue', handler: () => {
            if (interval) clearInterval(interval);
            resolve(true);
          }
        }]
      });
      alert.present();
      this.firebaseAnalytics.logEvent('custom_timeout', {});
      interval = setInterval(() => {
        this.ngZone.run(() => {
          alert.setSubTitle('Timeout: ' + timeoutSeconds);
        })
        if (!timeoutSeconds || timeoutSeconds <= 0) {
          if (interval) clearInterval(interval);
          alert.dismiss();
          resolve(true);
        }
        timeoutSeconds--;
      }, 1000);
    });
  }

  private showPreventInfiniteLoopDialog(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.alertCtrl.create({
        title: 'Infinite loop detected',
        message: 'Perhaps you forgot to put the BARCODE component, or you have a condition that is always false. Check your Output template. Do you want to continue?',
        buttons: [{
          text: 'Stop', role: 'cancel',
          handler: () => {
            let wsRequest = new requestModelUndoInfiniteLoop().fromObject({ count: ScanProvider.INFINITE_LOOP_DETECT_THRESHOLD });
            this.serverProvider.send(wsRequest);
            resolve(false);
          }
        }, {
          text: 'Continue', handler: () => {
            resolve(true);
          }
        }]
      }).present();
    });
  }

  /**
   * Injects variables like barcode, device_name, date and evaluates
   * the string parameter
   */
  private evalCode(code: string, variables: any) {
    // Inject variables
    let randomInt = this.getRandomInt() + '';
    // Typescript transpiles local variables such **barcode** and changes their name.
    // When eval() gets called it doesn't find the **barcode** variable and throws a syntax error.
    // To prevent that we store the barcode as a property of the **window** variable which doesn't change.
    // We use the randomInt as index insted of a fixed string to prevent collisions
    Object.defineProperty(window, randomInt, { value: {}, writable: true });
    Object.keys(variables).forEach(key => {
      // We use the hashedKey instead of the clear key to prevent the Regex below
      // replacing multiple times the variables with a similar name: eg. time and timestamp, barcode and barcodes, etc.
      // Warning: this approach can create issues when the user uses similar variable names in his/her code.
      let hashedKey = btoa(key);
      window[randomInt][hashedKey] = variables[key]; // We put the index like a literal, since randomInt can be transpiled too
      // 'barcode' = X2JhcmNvZGU=
      // replace each variable: eg. barcode, timestamp, quantity, etc. with window[0000001]['X2JhcmNvZGU=']
      code = code.replace(new RegExp(key, 'g'), 'window["' + randomInt + '"]["' + hashedKey + '"]');
    });

    // Run code
    try {
      return eval(code);
    } catch (error) {
      this.alertCtrl.create({
        title: 'Error',
        message: 'An error occurred while executing your Output template: ' + error,
        buttons: [{ text: 'Ok', role: 'cancel', }]
      }).present();
      throw new Error(error);
    } finally {
      // executed in either case before returning
      delete window[randomInt];
    }

    // Note:
    //     The previous solution: stringComponent.value.replace('barcode', '"' + barcode + '"');
    //     didn't always work because the **barcode** value is treated as a string immediately.
    //
    //  ie:
    //
    //     "this is
    //        as test".replace(...)
    //
    //     doesn't work because the first line doesn't have the ending \ character.
  }

  getRandomInt(max = Number.MAX_SAFE_INTEGER) {
    return Math.floor(Math.random() * Math.floor(max));
  }
}
