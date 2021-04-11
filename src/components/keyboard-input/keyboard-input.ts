import { Component, ViewChild } from '@angular/core';
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

  private locked = false;

  constructor(
    public platform: Platform,
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
    return this.isFocussed;
  }

  public lock(placeholder: string = null, backgroundColor: string = '') {
    this.locked = true;
    this.setPlaceholder(placeholder);
  }

  public unlock() {
    this.locked = false;
    this.setPlaceholder(null);
  }
}
