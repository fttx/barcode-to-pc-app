import { BarcodeModel } from './barcode.model'

export interface ScanModel {
    name: string;
    date: Date;
    data: BarcodeModel[];
}