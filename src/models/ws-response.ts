
export class wsResponse {
    public action: string;
    public message: string;

    constructor(obj?: any) {
        this.action = obj && obj.wsAction || null;
        this.message = obj && obj.message || null;
    }
}
