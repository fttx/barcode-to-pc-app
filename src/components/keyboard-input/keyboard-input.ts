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

  constructor(
  ) {
  }

  public focus(delay = 0) {
    // for some reason after that a dialog has been dismissed ionic changes the
    // focus to some other element, so we need to send again the focus command again
    setTimeout(() => {
      this.ionInput.setFocus();
    }, delay)
  }

  public submit() {
    if (this.value.length == 0) {
      return;
    }

    this.onSubmit.next(this.value);
    this.value = '';
  }
}
