import { Injectable } from '@angular/core';

/*
  Generated class for the Config provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Config {
  public static SERVER_PORT = 57891;
  public static REQUIRED_SERVER_VERSION = '1.1.0';
  public static WEBSITE_URL = 'https://barcodetopc.com/';
  public static WEBSITE_NAME = 'barcodetopc.com';
  public static FAQ_URL = 'https://barcodetopc.com/faq.html';
  public static INSTRUCTIONS_URL = 'https://barcodetopc.com/instructions.html';
  public static EMAIL_SUPPORT = 'filippo.tortomasi@gmail.com';
  public static DEFAULT_CONTINUE_MODE_TIMEOUT = 0;
  public static NO_RUNNINGS_BEFORE_SHOW_RATING = 5;
  public static SHOW_CANNOT_FIND_DIALOG_TIMEOUT = 90 * 1000;
  public static DEFAULT_REPEAT_INVERVAL = 500;

  constructor() {
  }

}
