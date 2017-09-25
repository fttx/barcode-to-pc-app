import { ServerModel } from "./server.model";

export interface discoveryResultModel {
    server: ServerModel;
    action: 'registered' | 'added' | 'resolved' | 'removed';
}