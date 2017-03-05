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
}