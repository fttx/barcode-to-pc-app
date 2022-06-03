import { Utils } from "../providers/utils";
import { Config } from "../providers/config";

export class ServerModel {
  ip: string;
  port: number = Config.SERVER_PORT;
  name: string;
  online: 'online' | 'offline' | 'connected' = 'offline';

  constructor(ip: string, port: number = Config.SERVER_PORT, name: string) {
    this.ip = ip;
    this.port = port;
    this.name = name;
  }

  equals(server: ServerModel) {
    if (!server) {
      return false;
    }
    return this.getAddress() == server.getAddress();
  }

  getAddress() {
    return this.ip + ':' + this.port;
  }

  public static serversFromJSON(jsonString: String): ServerModel[] {
    let result = [];
    if (jsonString.indexOf(Config.WEBSITE_NAME) == -1) {
      return result;
    }

    let hostname = Utils.getUrlParameterValue(jsonString, 'h');
    let addresses = Utils.getUrlParameterValue(jsonString, 'a').split('-');
    addresses.forEach(address => {
      result.push(ServerModel.AddressToServer(address, hostname));
    })
    return result;
  }

  static AddressToServer(address: string, name: string): ServerModel {
    const ip = address.split(':')[0];
    let port = Config.SERVER_PORT;
    if (address.split(':').length == 2) {
      const port = address.split(':')[1];
    }
    return new ServerModel(ip, port, name);
  }
}
