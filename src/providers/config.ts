import { Injectable } from '@angular/core';

/*
  Generated class for the Config provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Config {
  public static DEBUG = false;

  public static URL_WEBSITE = 'https://barcodetopc.com/';
  public static URL_INSTRUCTIONS = 'https://barcodetopc.com/faq.html#app-doesnt-find-computer';
  public static URL_FAQ = 'https://barcodetopc.com/faq.html';
  public static URL_GITHUB_CHANGELOG = 'https://raw.githubusercontent.com/fttx/barcode-to-pc-server/master/CHANGELOG.md';  

  public static SERVER_PORT = 57891;
  public static REQUIRED_SERVER_VERSION = '3.0.0';
  public static WEBSITE_NAME = 'barcodetopc.com';
  public static EMAIL_SUPPORT = 'filippo.tortomasi@gmail.com';
  public static DEFAULT_CONTINUE_MODE_TIMEOUT = 0;
  public static NO_RUNNINGS_BEFORE_SHOW_RATING = 5;
  public static SHOW_CANNOT_FIND_DIALOG_TIMEOUT = 90 * 1000;
  public static DEFAULT_REPEAT_INVERVAL = 500;
  public static GOOGLE_ANALYTICS_ID = 'UA-87867313-1';

  constructor() {
  }

}
