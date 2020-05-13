import { Component, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';


@Component({
  selector: 'keyboard-input',
  templateUrl: 'keyboard-input.html'
})
export class KeyboardInputComponent {
  @ViewChild('ionInput') ionInput;

  public onSubmit = new Subject<string>();
  public focussed = false;
  public value = '';
  public placeholder = 'Keyboard input';

  public hasError = false;

  constructor(
  ) {
  }

  public focus(delay = false) {
    // For some reason after that a dialog has been dismissed ionic changes the
    // focus to some other element, so we need to send again the focus command again
    // And we do it twice just in case the first time was too early.
    //
    // When delay is 0 it means that we're sure that the element can be focused
    // rightaway so we skip the first setFocus and only do the second immediatelly
    setTimeout(() => this.ionInput.setFocus(), delay ? 900 : 0)
  }

  public submit() {
    if (this.value.length == 0) {
      return;
    }

    this.onSubmit.next(this.value);
    this.value = '';
  }

  public setPlaceholder(placeholder = null) {
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
}
