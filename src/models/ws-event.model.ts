export class wsEvent {
    name: ('open' | 'close' | 'error')
    public static readonly EVENT_OPEN = 'open'
    public static readonly EVENT_CLOSE = 'close'
    public static readonly EVENT_ERROR = 'error'
}