import { Injectable } from '@angular/core';

/*
  Generated class for the Config provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Config {
  public static DEBUG = false;

  public static ZEROCONF_SERVER_NAME_OLD = 'Barcode to PC server';
  public static ZEROCONF_SERVER_NAME = 'barcode-to-pc-server-';

  public static URL_WEBSITE = 'https://barcodetopc.com/';
  public static URL_COMPANY_WEBSITE = 'https://eesystems.it/';
  public static URL_INSTRUCTIONS = 'https://barcodetopc.com/frequently-asked-questions/#app-doesnt-find-computer';
  public static URL_PRIVACY_POLICY = 'https://barcodetopc.com/app-privacy-policy/'
  public static URL_FAQ = 'https://barcodetopc.com/frequently-asked-questions/';
  public static URL_GITHUB_CHANGELOG = 'https://raw.githubusercontent.com/fttx/barcode-to-pc-server/master/CHANGELOG.md';

  public static URL_INCENTIVE_EMAIL_WEBHOOK = 'https://n8n.eesystems.it/webhook/incentive-email-download'
  public static URL_CLOUD_PING = 'https://n8n.eesystems.it/webhook/ping';
  public static URL_GOOGLE_SHEETS_WEBHOOK = 'https://gsheets.eesystems.it/webhook/v4.8.10-gsheet';

  public static URL_LICENSE_SERVER = 'https://license.barcodetopc.com/v5';
  public static URL_LICENSE_SERVER_ENTERPRISE_CLAIM = 'https://license.barcodetopc.com/v5/enterprise/claim';

  public static URL_BONUS_SCANS = 'https://formbricks.eesystems.it/s/cm9gbku9e00j7qu01a42qwzb2';

  public static DOCS_ANDROID_PDA = 'https://docs.barcodetopc.com/examples/android-pda-devices/';
  public static DOCS_QRBILL = 'https://docs.barcodetopc.com/special-barcodes/swiss-qr-codes/qr-bill/';

  public static SERVER_PORT = 57891;
  public static WEBSITE_NAME = 'barcodetopc.com';
  public static COMPANY_WEBSITE_NAME = 'eesystems.it';
  public static EMAIL_SUPPORT = 'support@barcodetopc.com';
  public static DEFAULT_CONTINUE_MODE_TIMEOUT = 0;
  public static NO_RUNNINGS_BEFORE_SHOW_RATING = 5;
  public static NO_RUNNINGS_BEFORE_SHOW_SOUND_FEEDBACK_OR_DIALOG = 3;
  public static NO_RUNNINGS_MAX_TO_SHOW_IS_PDA_DEVICE_DIALOG = 4;
  public static SHOW_CANNOT_FIND_DIALOG_TIMEOUT = 90 * 1000;
  public static DEFAULT_REPEAT_INVERVAL = 500;
  public static DEFAULT_ACQUISITION_LABEL = "Move the finder over a barcode";

  constructor() {
  }

}
