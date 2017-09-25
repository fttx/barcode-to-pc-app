import { BarcodeScanResult } from "@ionic-native/barcode-scanner";

export class ScanModel implements BarcodeScanResult {
    format: "QR_CODE" | "DATA_MATRIX" | "UPC_E" | "UPC_A" | "EAN_8" | "EAN_13" | "CODE_128" | "CODE_39" | "CODE_93" | "CODABAR" | "ITF" | "RSS14" | "RSS_EXPANDED" | "PDF417" | "AZTEC" | "MSI";
    cancelled: boolean;
    text: string;
    id: number;
}