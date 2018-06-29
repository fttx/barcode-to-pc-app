export class barcodeFormatModel {
    name: string;
    enabled: boolean;

    static supportedBarcodeFormats = [
        'QR_CODE', 'DATA_MATRIX', 'UPC_E', 'UPC_A', 'EAN_8', 'EAN_13', 'CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'ITF', 'RSS14', 'RSS_EXPANDED', 'PDF417', 'AZTEC', 'MSI'
    ].map((value, index) => {
        if (value == 'PDF417' || value == 'RSS_EXPANDED') {
            return new barcodeFormatModel(value, false)
        }
        return new barcodeFormatModel(value, true)
    });

    constructor(name: string, enabled: boolean) {
        this.name = name;
        this.enabled = enabled;
    }
}