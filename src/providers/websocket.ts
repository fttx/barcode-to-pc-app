import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/fromEvent';
/*
  Generated class for the WebSocket provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class WebSocketProvider {
  private webSocket: WebSocket;

  constructor(
    public address: string
  ) {
    this.webSocket = new WebSocket(this.address);
  }

  public onMessage(): Observable<Event> {
    return Observable.fromEvent(this.webSocket, 'message');
  }

  public onOpen(): Observable<Event> {
    return Observable.fromEvent(this.webSocket, 'open');
  }

  public onError(): Observable<Event> {
    return Observable.fromEvent(this.webSocket, 'error');
  }
}
