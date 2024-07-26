import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { trigger, state, style, transition, animate } from '@angular/animations';

/**
 * Generated class for the BtpToastComponent component.
 *
 * See https://angular.io/api/core/Component for more info on Angular
 * Components.
 */
@Component({
  selector: 'btp-toast',
  templateUrl: 'btp-toast.html',
  animations: [
    trigger('slideInOut', [
      state('in', style({
        opacity: '1'
      })),
      state('out', style({
        opacity: '0'
      })),
      transition('in => out', animate('400ms ease-in-out')),
      transition('out => in', animate('400ms ease-in-out'))
    ])
  ]
})
export class BtpToastComponent {
  @Input() severity: 'info' | 'success' | 'warning' | 'error' = 'info';
  @Input() text: string = '';
  @ViewChild('marquee') marquee: ElementRef;
  isOpen = false;

  constructor() {
  }

  present(text, severity: 'info' | 'success' | 'warning' | 'error' = 'info', duration = null) {
    // Get current route and add class to fix glitch when on scan-session page
    this.text = text;
    this.severity = severity;
    this.isOpen = true;

    if (!duration) duration = 3000;

    setTimeout(() => {
      const marqueeElement = this.marquee.nativeElement;
      const parentWidth = marqueeElement.parentElement.clientWidth;
      const textWidth = marqueeElement.scrollWidth;
      if (textWidth > parentWidth) {
        marqueeElement.classList.add('marquee');
        duration += 2000;
      } else {
        marqueeElement.classList.remove('marquee');
      }
    }, 2500);

    setTimeout(() => {
      this.isOpen = false;
    }, duration);
  }
}
