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
  private webSocket: WebSocket = new WebSocket(this.address);
  public observable: Observable<Event>;

  constructor(public address: string) {
    this.observable = Observable.create(observer => {
      this.webSocket.onmessage = (message) => observer.next(message);
      this.webSocket.onopen = () => observer.next();
      this.webSocket.onerror = (msg) => Observable.throw(new Error(JSON.stringify(msg)))
    });
  }

  public send(object: any) {
    this.webSocket.send(JSON.stringify(object));
  }
}
