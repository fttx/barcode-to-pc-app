import { ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { Platform } from 'ionic-angular';
import { Subject } from 'rxjs';


@Component({
  selector: 'keyboard-input',
  templateUrl: 'keyboard-input.html'
})
export class KeyboardInputComponent {
  @ViewChild('ionInput') ionInput;

  public onSubmit = new Subject<string>();
  public _focussed = false;
  public value = '';
  public placeholder = 'Keyboard input';
  public hasError = false;

  public disabled = false;
  public locked = false;

  constructor(
    public platform: Platform,
    public cdr: ChangeDetectorRef
  ) {
  }

  public focus(delay = false) {
    // For some reason after that a dialog has been dismissed ionic changes the
    // focus to some other element, so we need to send again the focus command again
    // And we do it twice just in case the first time was too early.
    //
    // When delay is 0 it means that we're sure that the element can be focused
    // rightaway so we skip the first setFocus and only do the second immediatelly
    let ms = this.platform.is('ios') ? 100 : 900;
    setTimeout(() => this.ionInput.setFocus(), delay ? ms : 0);
  }

  public blur() {
    this.ionInput.getNativeElement().querySelector('input').blur();
    let blurcount = 0;
    const blurrer = setInterval(() => {
      this.ionInput.getNativeElement().querySelector('input').blur();
      if (blurcount++ > 10) {
        clearInterval(blurrer);
      }
    }, 100);
  }

  public submit() {
    if (this.locked) {
      return;
    }

    if (this.value.length == 0) {
      return;
    }

    this.onSubmit.next(this.value);
    this.value = '';
  }

  public setPlaceholder(placeholder: string = null) {
    if (placeholder) {
      this.placeholder = placeholder;
    } else {
      this.placeholder = 'Keyboard input';
    }
    this.hasError = false;
  }

  public setError(errorMessage: string | boolean) {
    if (errorMessage) {
      this.placeholder = 'Error: ' + errorMessage;
    }
    this.hasError = !!errorMessage;
  }

  public isFocussed() {
    return this._focussed;
  }

  public lock(placeholder: string = null, backgroundColor: string = '') {
    this.locked = true;
    this.setPlaceholder(placeholder);
  }

  public unlock() {
    this.locked = false;
    this.setPlaceholder(null);
  }

  public disable(disabled: boolean) {
    this.disabled = disabled;
  }

  public isDisabled() {
    return this.disabled;
  }

  public onFocus() {
    this._focussed = true;
    this.cdr.detectChanges();
  }

  public onBlur() {
    this._focussed = false;
    this.cdr.detectChanges();
  }
}
