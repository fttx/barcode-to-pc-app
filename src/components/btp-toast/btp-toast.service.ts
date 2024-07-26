import { Injectable } from '@angular/core';
import { BtpToastComponent } from './btp-toast';

@Injectable()
export class BtpToastService {
  private toastComponent: BtpToastComponent;

  constructor() { }

  setToastComponent(toastComponent: BtpToastComponent) {
    console.log('setToastComponent');
    this.toastComponent = toastComponent;
  }

  present(text, severity: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) {
    this.toastComponent.present(text, severity, duration);
  }
}
