import { Utils } from "../providers/utils";
import { Config } from "../providers/config";

export class ServerModel {
    address: string;
    name: string;
    online: boolean;

    constructor(address: string, name: string) {
        this.address = address;
        this.name = name;
    }

    equals(server: ServerModel) {
        return this.address == server.address;
    }

    public static serversFromJSON(jsonString: String): ServerModel[] {
        let result = [];
        if (jsonString.indexOf(Config.WEBSITE_NAME) == -1) {
            return result;
        }
        
        let hostname = Utils.getUrlParameterValue(jsonString, 'h');
        let addresses = Utils.getUrlParameterValue(jsonString, 'a').split('-');
        addresses.forEach(address => {
            result.push(new ServerModel(address, hostname));
        })
        return result;
    }
}