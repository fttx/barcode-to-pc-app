export class wsEvent {
    ws: WebSocket;
    name: ('open' | 'close' | 'error' | 'alreadyOpen')
    public static readonly EVENT_OPEN = 'open'
    public static readonly EVENT_ALREADY_OPEN = 'alreadyOpen'
    public static readonly EVENT_CLOSE = 'close'
    public static readonly EVENT_ERROR = 'error'
}