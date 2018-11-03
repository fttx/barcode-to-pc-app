import { ScanModel } from './scan.model'

/**
 * When editing this interface make you sure to update also the
 * ScanSessionsStorage methods
 */
export interface ScanSessionModel {
    id: number;
    name: string;
    date: number;
    scannings: ScanModel[];
    selected: boolean;
}