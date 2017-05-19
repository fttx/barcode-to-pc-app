import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';

/*
  Generated class for the Utils provider.

  See https://angular.io/docs/ts/latest/guide/dependency-injection.html
  for more info on providers and Angular 2 DI.
*/
@Injectable()
export class Utils {

  constructor(

  ) {

  }

  public static getUrlParameterValue(url, parameterName) {
    parameterName = parameterName.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + parameterName + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  }
}
