import { Injectable, NgZone } from '@angular/core';
import { BarcodeScanner, BarcodeScannerOptions, BarcodeScanResult } from '@fttx/barcode-scanner';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { AlertController, Platform } from 'ionic-angular';
import { Observable, Subscription } from 'rxjs';
import { KeyboardInputComponent } from '../components/keyboard-input/keyboard-input';
import { OutputBlockModel } from '../models/output-block.model';
import { OutputProfileModel } from '../models/output-profile.model';
import { ScanModel } from '../models/scan.model';
import { SelectScanningModePage } from '../pages/scan-session/select-scanning-mode/select-scanning-mode';
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
    public isQuantityDialogOpen = false;
    public awaitingForBarcode: boolean;

    private pluginOptions: BarcodeScannerOptions

    // This parameter is different from SelectScanningModePage.SCAN_MODE_* but
    // it kinds of extends it.
    // The SCAN_MODE_* is more related to the UI, so what the user is able to
    // choose, while the acquisitionMode is how actually the barcode acquisition
    // is performed.
    // This separation is required in order to allow the mixed_continue when
    // there is a quantity parameter or when the native plugin doesn't support
    // the continue mode.
    public acqusitionMode: 'manual' | 'single' | 'mixed_continue' | 'continue' = 'manual';
    private barcodeFormats;
    private outputProfile: OutputProfileModel;
    private deviceName: string;
    private quantityType: string;
    private keyboardInput: KeyboardInputComponent;

    constructor(
        private alertCtrl: AlertController,
        private barcodeScanner: BarcodeScanner,
        private platform: Platform,
        private ngZone: NgZone,
        private ga: GoogleAnalytics,
        private settings: Settings,
    ) {
    }

    /**
     * It returns an Observable that will output a ScanModel everytime the
     * current OutputProfile is completed.
     *
     * Whenever the scan process ends or is interrupted, it will send
     * an "complete" event
     *
     * @param scanMode SCAN_MODE_CONTINUE, SCAN_MODE_SINGLE or SCAN_MODE_MANUAL
     */
    scan(scanMode, keyboardInput: KeyboardInputComponent): Observable<ScanModel> {
        this.keyboardInput = keyboardInput;

        return new Observable(observer => {
            Promise.all([
                this.settings.getPreferFrontCamera(), // 0
                this.settings.getEnableLimitBarcodeFormats(), // 1
                this.settings.getBarcodeFormats(), // 2
                this.settings.getQuantityType(), // 3
                this.settings.getContinueModeTimeout(), // 4
                this.settings.getDeviceName(), // 5
                this.getOutputProfile(), //6
            ]).then(async result => {
                // parameters
                let preferFrontCamera = result[0];
                let enableLimitBarcodeFormats = result[1];
                this.barcodeFormats = result[2];
                let quantityType = result[3];
                let continueModeTimeout = result[4];
                this.deviceName = result[5];
                this.outputProfile = result[6];
                let quantityEnabled = OutputProfileModel.HasQuantityBlocks(this.outputProfile);


                // other computed parameters
                this.quantityType = quantityType || 'number';
                switch (scanMode) {
                    case SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY: this.acqusitionMode = 'manual'; break;
                    case SelectScanningModePage.SCAN_MODE_SINGLE: this.acqusitionMode = 'single'; break;
                    case SelectScanningModePage.SCAN_MODE_CONTINUE: {
                        this.acqusitionMode = 'continue';
                        if (quantityEnabled || !this.platform.is('android') || continueModeTimeout) {
                            this.acqusitionMode = 'mixed_continue';
                        }
                        break;
                    }
                }

                // native plugin options
                let pluginOptions: BarcodeScannerOptions = {
                    showFlipCameraButton: true,
                    prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
                    showTorchButton: true,
                    preferFrontCamera: preferFrontCamera,
                    continuousMode: this.acqusitionMode == 'continue',
                };
                if (enableLimitBarcodeFormats) {
                    pluginOptions.formats = this.barcodeFormats.filter(barcodeFormat => barcodeFormat.enabled).map(barcodeFormat => barcodeFormat.name).join(',');
                }
                this.pluginOptions = pluginOptions;


                // again() encapsulates the part that need to be repeated when
                // the continuos mode is active
                let again = async () => {
                    // scan result
                    let scan = new ScanModel();
                    let now = new Date().getTime();
                    scan.outputBlocks = JSON.parse(JSON.stringify(this.outputProfile.outputBlocks)) // copy object
                    scan.id = now;
                    scan.repeated = false;
                    scan.date = now;

                    // variables that can be used in the 'function' and 'if' OutputBlocks
                    let variables = {
                        barcode: '',
                        barcodes: [],
                        quantity: null,
                        timestamp: (scan.date * 1000),
                        device_name: this.deviceName,
                    }

                    // run the OutputProfile
                    for (let i = 0; i < scan.outputBlocks.length; i++) {
                        let outputBlock = scan.outputBlocks[i];
                        switch (outputBlock.type) {
                            // some componets like 'key' and 'text', do not need any processing from the
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
                                    case 'quantity': {
                                        try {
                                            outputBlock.value = await this.getQuantity();
                                        } catch (err) {
                                            // this code fragment is duplicated for the 'barcode' block
                                            observer.complete();
                                            return; // returns the again() function
                                        }
                                        // it's ok to always include the quantity variable, since even if the user
                                        // doesn't have the license he won't be able to create the output profile
                                        variables.quantity = outputBlock.value;
                                        scan.quantity = outputBlock.value; // backwards compatibility
                                        break;
                                    }
                                } // switch outputBlock.value
                                break;
                            }
                            case 'function': {
                                outputBlock.value = this.evalCode(outputBlock.value, variables);
                                break;
                            }
                            case 'barcode': {
                                try {
                                    let barcode = await this.getBarcode();
                                    variables.barcode = barcode;
                                    variables.barcodes.push(barcode);
                                    outputBlock.value = barcode;
                                } catch (err) {
                                    // this code fragment is duplicated for the 'quantity' block
                                    observer.complete();
                                    return; // returns the again() function
                                }
                            }
                            case 'delay': break;
                            case 'if': {
                                let condition = this.evalCode(outputBlock.value, variables);
                                if (condition === false) {
                                    // the if condition is false, we must branch
                                    // the current i value is pointing to the 'if' block, we start searching from
                                    // the next block, that is the (i + 1)th
                                    let endIfIndex = OutputBlockModel.FindEndIfIndex(scan.outputBlocks, i + 1);

                                    // remove the blocks inside the if (including the current block that is an if, and the endif)
                                    // splice(startFrom (included), noElementsToRemove (included))
                                    scan.outputBlocks.splice(i, endIfIndex);
                                }
                                break;
                            }
                        }
                    }

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
    /// subscription to the last getBarcode promise.
    // lastReject and lastResolve relay on the fact that it will never be
    // simultanius calls to getBarcode() method, it will always be called
    // sequencially. The explaination is that the loop contained in the start()
    // method isn't allowed to go haed until the previus getBarcode doesn't get
    // resolved.
    private lastResolve;
    private lastReject;
    private continuosScanSubscription: Subscription = null;

    private getBarcode(): Promise<string> {
        this.awaitingForBarcode = true;

        let promise = new Promise<string>(async (resolve, reject) => {
            switch (this.acqusitionMode) {
                case 'single':
                case 'mixed_continue': {
                    let barcodeScanResult: BarcodeScanResult = await this.barcodeScanner.scan(this.pluginOptions).first().toPromise();
                    if (!barcodeScanResult || barcodeScanResult.cancelled) {
                        // it should be equivalent to reject() + return
                        throw new Error('cancelled');
                    }
                    // CODE_39 fix (there is a copy of this fix in the CONTINUE mode part, if you change this then you have to change also the other one )
                    if (barcodeScanResult.text && barcodeScanResult.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
                        barcodeScanResult.text = Utils.convertCode39ToCode32(barcodeScanResult.text);
                    }
                    // END CODE_39 fix
                    resolve(barcodeScanResult.text);
                    break;
                }
                // It is used only if there is no quantity and the user selected
                // the continuos mode. The only way to exit is to press cancel.
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
                            this.lastResolve(barcodeScanResult.text);
                        }, error => {
                            // this should never be called
                        }, () => {
                            // this should never be called
                        })
                    }
                    break;
                }

                case 'manual': {
                    this.keyboardInput.focus(800);
                    // here we don't wrap the promise inside a try/catch statement because there
                    // isn't a way to cancel a manual barcode acquisition
                    resolve(await this.keyboardInput.onSubmit.first().toPromise());
                    break;
                }
            } // switch acqusitionMode
        }); // promise

        promise
            .then(value => { this.awaitingForBarcode = false;; })
            .catch(err => { this.awaitingForBarcode = false; })
        return promise;
    }

    public async updateOutputProfile() {
        this.outputProfile = await this.getOutputProfile();
    }

    private async getOutputProfile(): Promise<OutputProfileModel> {
        let profiles = await this.settings.getOutputProfiles();
        return new Promise<OutputProfileModel>((resolve, reject) => {
            // Let the user chose through the UI
            resolve(profiles[0]);
        });
    }

    private getQuantity(): Promise<string> { // doesn't need to be async becouse doesn't contain awaits
        return new Promise((resolve, reject) => {
            let alert = this.alertCtrl.create({
                title: 'Enter quantity value',
                // message: 'Inse',
                enableBackdropDismiss: false,
                inputs: [{ name: 'quantity', type: this.quantityType, placeholder: this.quantityType == 'number' ? '(Default is 1, press Ok to insert it)' : 'Eg. ten' }],
                buttons: [{
                    text: 'Ok',
                    handler: data => {
                        if (data.quantity) { // && isNumber(data.quantity)
                            resolve(data.quantity)
                        } else if (this.quantityType == 'number') {
                            resolve('1')
                        }
                    }
                }, {
                    role: 'cancel', text: 'Cancel',
                    handler: () => {
                        reject('cancelled');
                    }
                }]
            });
            this.isQuantityDialogOpen = true;
            alert.setLeavingOpts({ keyboardClose: false });
            alert.onDidDismiss(() => {
                this.isQuantityDialogOpen = false;
            })
            alert.present();
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
            this.ga.trackEvent('scannings', 'custom_timeout', null, timeoutSeconds);
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

    /**
     * Injects variables like barcode, device_name, date and evaluates
     * the string parameter
     */
    private evalCode(code: string, variables: any) {
        // Inject variables
        let randomInt = this.getRandomInt() + '';
        // Typescript transpiles local variables such **barcode** and changes their name.
        // When eval() gets called it doesn't find the **barcode** variable and throws a syntax error.
        // To prevent that i store the barcode inside the variable **window** which doesn't change.
        // I use the randomInt as index insted of a fixed string to enforce mutual exclusion
        Object.defineProperty(window, randomInt, { value: {}, writable: true });
        Object.keys(variables).forEach(key => {
            // console.log('key: ', key);
            window[randomInt]['_' + key] = variables[key]; // i put the index like a literal, since randomInt can be transpiled too
            code = code.replace(new RegExp(key, 'g'), 'window["' + randomInt + '"]["_' + key + '"]');
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
            return '';
        } finally {
            // executed in each case before return
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
