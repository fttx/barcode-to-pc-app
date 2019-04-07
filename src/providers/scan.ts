import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';
import { ScanModel } from '../models/scan.model';
import { SelectScanningModePage } from '../pages/scan-session/select-scanning-mode/select-scanning-mode';
import { Settings } from './settings';
import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { Platform, AlertController } from 'ionic-angular';
import { BarcodeScanner, BarcodeScannerOptions, BarcodeScanResult } from '@fttx/barcode-scanner';
import { OutputProfileModel } from '../models/output-profile.model';
import { OutputBlockModel } from '../models/output-block.model';
import { Utils } from './utils';

/**
 * The job of this class is to generate a ScanModel by talking with the native
 * barcode scanner plugin and/or by asking the user the required data to fill
 * the data of the selected OutputProfile.
 * 
 * The only public function is start()
 */
@Injectable()
export class ScanProvider {
    public isQuantityDialogOpen = false;

    private pluginOptions: BarcodeScannerOptions
    private barcodeFormats;
    private outputProfile: OutputProfileModel;
    private deviceName: string;
    private quantityType: string;

    constructor(
        private alertCtrl: AlertController,
        private barcodeScanner: BarcodeScanner,
        private platform: Platform,
        private ngZone: NgZone,
        private ga: GoogleAnalytics,
        private settings: Settings,
    ) {
        this.settings.getDeviceName().then(deviceName => this.deviceName = deviceName);
    }

    /**
     * This function takes care to collect the data required from the native barcode-scanner plugin,
     * or from the user.
     * 
     * It returns an Observable that will spit out a ScanModel everytime an OutputProfile is completed.
     * 
     * Whenever for whatever reason the scan process ends or is interrupted, it will send an "complete" event
     * 
     * @param mode CONTINUE, SINGLE, MANUAL
     * @param manualInputObservable 
     */
    start(mode, manualInputObservable: Observable<string> = null): Observable<ScanModel> {
        return new Observable(observer => {
            Promise.all([
                this.settings.getPreferFrontCamera(), // 0
                this.settings.getEnableLimitBarcodeFormats(), // 1
                this.settings.getBarcodeFormats(), // 2
                this.settings.getQuantityType(), // 3
                this.settings.getContinueModeTimeout(), // 4 
                this.getOutputProfile() //5
            ]).then(result => {
                let preferFrontCamera = result[0];
                let enableLimitBarcodeFormats = result[1];
                this.barcodeFormats = result[2];
                let quantityType = result[3];
                let continueModeTimeout = result[4];
                this.outputProfile = result[5];
                let quantityEnabled = OutputProfileModel.HasQuantityBlocks(this.outputProfile);

                this.quantityType = quantityType || 'number';
                let pluginContinuousMode = mode == SelectScanningModePage.SCAN_MODE_CONTINUE;
                if (quantityEnabled || !this.platform.is('android') || continueModeTimeout) {
                    pluginContinuousMode = false;
                }

                // pluginOptions
                let pluginOptions: BarcodeScannerOptions = {
                    showFlipCameraButton: true,
                    prompt: "Place a barcode inside the scan area.\nPress the back button to exit.", // supported on Android only
                    showTorchButton: true,
                    preferFrontCamera: preferFrontCamera,
                    continuousMode: pluginContinuousMode,
                };
                if (enableLimitBarcodeFormats) {
                    pluginOptions.formats = this.barcodeFormats.filter(barcodeFormat => barcodeFormat.enabled).map(barcodeFormat => barcodeFormat.name).join(',');
                }
                this.pluginOptions = pluginOptions;
                // end pluginOptions

                // determine the nuber of barcodes to accumulate before running the OutputProfile
                let numberOfBarcodes = this.outputProfile.outputBlocks.filter(x => x.type == 'barcode').length;

                switch (mode) {
                    case SelectScanningModePage.SCAN_MODE_SINGLE:
                        this.runOutputProfile().then(scan => {
                            observer.next(scan);
                            observer.complete();
                        }).catch(error => observer.complete())
                        break;

                    case SelectScanningModePage.SCAN_MODE_CONTINUE:
                        // MIXED SCAN_MODE_CONTINUE
                        // if for some reason we weren't able to start the pure mode, 
                        // we must call runOutputProfile() indefinitely.
                        if (this.pluginOptions.continuousMode == false) {
                            let again = () => {
                                this.runOutputProfile().then(scan => {
                                    observer.next(scan);
                                    if (!continueModeTimeout) {
                                        again(); // loop
                                    } else {
                                        this.showAddMoreDialog(continueModeTimeout).then((addMore) => {
                                            if (addMore) {
                                                again();// if the user clicks yes => loop
                                            } else {
                                                observer.complete();
                                            }
                                        })
                                    }
                                }).catch(error => observer.complete()) // if the user clicks the back button
                            };
                            again(); // call the first time
                            break;
                        }

                        // PURE SCAN_MODE_CONTINUE
                        // barcode accumulator
                        let barcodes = [];

                        let scanSubscription = this.barcodeScanner.scan(this.pluginOptions).subscribe(barcodeScanResult => {
                            if (!barcodeScanResult || barcodeScanResult.cancelled) {
                                scanSubscription.unsubscribe();
                                observer.complete();
                            }

                            // CODE_39 fix (there is a copy of this fix in the SINGLE mode part, if you change this then you have to change also the other one )
                            if (barcodeScanResult.text && barcodeScanResult.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
                                barcodeScanResult.text = Utils.convertCode39ToCode32(barcodeScanResult.text);
                            }
                            // END CODE_39 fix

                            barcodes.unshift(barcodeScanResult.text);

                            // Once there are enough barcodes i can "run" the OutputProfile
                            if (barcodes.length == numberOfBarcodes) {
                                let barcodesStack = barcodes.slice(0); // copy the array
                                barcodes = [];
                                this.runOutputProfile(barcodesStack).then(scan => {
                                    observer.next(scan); // I pass the ScanModel to the upper level
                                });
                            }
                        })
                        break;

                    case SelectScanningModePage.SCAN_MODE_ENTER_MAUALLY:
                        if (!manualInputObservable) {
                            observer.complete();
                            break;
                        }

                        // barcode accumulator
                        barcodes = [];

                        manualInputObservable.subscribe(barcode => {
                            barcodes.unshift(barcode);

                            // Once there are enough barcodes i can "run" the OutputProfile
                            if (barcodes.length == numberOfBarcodes) {
                                let barcodesStack = barcodes.slice(0); // copy the array
                                barcodes = [];
                                this.runOutputProfile(barcodesStack).then(scan => {
                                    observer.next(scan); // I pass the ScanModel to the upper level
                                });
                            }
                        });
                        break;
                }
            });
        })
    }

    /**
     * 
     * @param barcodesStack contains n barcodes received from the scan plugin, 
     * where n is the number of barcodes required from the selected outputProfile
     */
    private async runOutputProfile(barcodesStack = null): Promise<ScanModel> {
        // scan
        let scan = new ScanModel();
        let now = new Date().getTime();
        scan.outputBlocks = JSON.parse(JSON.stringify(this.outputProfile.outputBlocks)) // copy object
        scan.id = now;
        scan.repeated = false;
        scan.date = now;

        // variables used for 'function' outputBlocks
        let barcode = '';
        let barcodes = [];

        for (let outputBlock of scan.outputBlocks) {
            // some outputblock need to be filled with data befere beign added to the ScanModel
            switch (outputBlock.type) {
                case 'key': break;
                case 'text': break;
                case 'variable': {
                    switch (outputBlock.value) {
                        case 'deviceName': outputBlock.value = this.deviceName; break;
                        case 'timestamp': outputBlock.value = (scan.date * 1000) + ''; break;
                        case 'date': outputBlock.value = new Date(scan.date).toLocaleDateString(); break;
                        case 'time': outputBlock.value = new Date(scan.date).toLocaleTimeString(); break;
                        case 'date_time': new Date(scan.date).toLocaleTimeString() + ' ' + new Date(scan.date).toLocaleDateString(); break;
                        case 'quantity': outputBlock.value = await this.showQuantityDialog(); break; // throws cancelled
                    }
                    break;
                }
                case 'function': {
                    // Typescript transpiles local variables such **barcode** and changes their name.
                    // When eval() gets called it doesn't find the **barcode** variable and throws a syntax error.
                    // To prevent that i store the barcode inside the variable **window** which doesn't change.
                    // I use the scan.id as index insted of a fixed string to enforce mutual exclusion
                    window[scan.id] = {
                        '_bdes': barcodes,
                        '_bde': barcode,
                    };
                    let code = outputBlock.value
                        .replace(/barcodes/g, 'window[' + scan.id + ']._bdes') // i put the index like a literal, since scan.id can be transpiled too
                        .replace(/barcode/g, 'window[' + scan.id + ']._bde');
                    console.log('code=', code)
                    try {
                        outputBlock.value = eval(code);
                    } catch (error) {
                        outputBlock.value = '';
                        console.log('Custom function error: ', error)
                        // TODO show error dialog
                    }
                    delete window[scan.id];
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
                    break;
                }
                case 'barcode': {
                    // When barcodesStack is null it means that we inside
                    // a **MIXED** SCAN_MODE_CONTINUE or SCAN_MODE_SINGLE
                    if (!barcodesStack) {
                        let barcodeScanResult: BarcodeScanResult = await this.barcodeScanner.scan(this.pluginOptions).first().toPromise();
                        if (!barcodeScanResult || barcodeScanResult.cancelled) {
                            throw new Error('cancelled');
                        }
                        // CODE_39 fix (there is a copy of this fix in the CONTINUE mode part, if you change this then you have to change also the other one )
                        if (barcodeScanResult.text && barcodeScanResult.format == 'CODE_39' && this.barcodeFormats.findIndex(x => x.enabled && x.name == 'CODE_32') != -1) {
                            barcodeScanResult.text = Utils.convertCode39ToCode32(barcodeScanResult.text);
                        }
                        // END CODE_39 fix

                        barcode = barcodeScanResult.text;
                        barcodes.push(barcodeScanResult.text);
                        outputBlock.value = barcodeScanResult.text;
                        // Otherwise it means that we are in a **PURE** SCAN_MODE_CONTINUE, 
                        // and we'll receive all required barcodes inside a barcodesStack, all at once.
                    } else {
                        barcode = barcodesStack.pop();
                        barcodes.push(barcode);
                        outputBlock.value = barcode;
                    }
                }
                case 'delay': break;
            }
        }
        return scan;
    }

    private async getOutputProfile(): Promise<OutputProfileModel> {
        let profiles = await this.settings.getOutputProfiles();
        return new Promise<OutputProfileModel>((resolve, reject) => {
            // Let the user chose through the UI
            resolve(profiles[0]);
        });
    }

    private showQuantityDialog(): Promise<string> { // doesn't need to be async becouse doesn't contain awaits
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
                if (timeoutSeconds == 0) {
                    if (interval) clearInterval(interval);
                    alert.dismiss();
                    resolve(true);
                }
                timeoutSeconds--;
            }, 1000);
        });
    }
}
