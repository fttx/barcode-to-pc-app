import { Injectable } from '@angular/core';

/*
  Generated class for the Config provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Config {
  public static SERVER_PORT = 57891;
  public static REQUIRED_SERVER_VERSION = '2.0.0';
  public static WEBSITE_URL = 'https://barcodetopc.com/';
  public static WEBSITE_NAME = 'barcodetopc.com';
  public static FAQ_URL = 'https://barcodetopc.com/faq.html';
  public static INSTRUCTIONS_URL = 'https://barcodetopc.com/faq.html#app-doesnt-find-computer';
  public static GITHUB_LATEST_RELEASE_URL = 'https://api.github.com/repos/fttx/barcode-to-pc-app/releases';  
  public static EMAIL_SUPPORT = 'filippo.tortomasi@gmail.com';
  public static DEFAULT_CONTINUE_MODE_TIMEOUT = 0;
  public static NO_RUNNINGS_BEFORE_SHOW_RATING = 5;
  public static SHOW_CANNOT_FIND_DIALOG_TIMEOUT = 90 * 1000;
  public static DEFAULT_REPEAT_INVERVAL = 500;
  public static GOOGLE_ANALYTICS_ID = 'UA-87867313-1';
  public static GOOGLE_ANALYTICS_DEBUG = false;

  constructor() {
  }

}
