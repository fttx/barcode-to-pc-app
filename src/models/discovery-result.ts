import { ServerModel } from "./server.model";

export interface discoveryResult {
    server: ServerModel;
    action: 'registered' | 'added' | 'resolved' | 'removed';
}