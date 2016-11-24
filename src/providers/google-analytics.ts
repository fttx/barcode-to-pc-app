import { Injectable } from '@angular/core';
import { GoogleAnalytics } from 'ionic-native';
import { Platform } from 'ionic-angular';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/forkJoin';

/**
 * Thanks to: https://github.com/peterpeterparker
 * See also: https://github.com/danwilson/google-analytics-plugin/issues/291
 */

@Injectable()
export class GoogleAnalyticsService {

    viewNotSent: any[] = new Array();
    eventNotSent: any[] = new Array();
    trackerInitialized: boolean = false;
    platformReady: boolean = false;

    constructor(platform: Platform) {
        platform.ready().then(() => this.platformReady = true);
    }

    trackView(viewName: string) {
        if (!this.platformReady) {
            this.viewNotSent.push({ viewName: viewName });
        } else {
            this.initGoogleAnalytics().then(() => {
                this.trackViewNotSent().then(() => {
                    GoogleAnalytics.trackView(viewName).then(() => {
                        // Do nothing
                    });
                });
            }, (error: any) => {
                this.viewNotSent.push({ viewName: viewName });
            });
        }
    }

    private trackViewNotSent(): Promise<{}> {
        return new Promise((resolve) => {
            if (this.viewNotSent == null || Object.keys(this.viewNotSent).length === 0) {
                resolve();
            } else {
                let promises = new Array();

                for (let i: number = 0; i < this.viewNotSent.length; i++) {
                    promises.push(GoogleAnalytics.trackView(this.viewNotSent[i].viewName));
                }

                Observable.forkJoin(promises).subscribe(
                    (data: any) => {
                        this.viewNotSent = new Array();
                        resolve();
                    });
            }
        });
    }

    trackEvent(category: string, action: string, label: string = null, value: number = null, newSession: boolean = null) {
        if (!this.platformReady) {
            this.eventNotSent.push({ category: category, action: action, label: label, newSession: newSession });
        } else {
            this.initGoogleAnalytics().then(() => {
                this.trackEventNotSent().then(() => {
                    GoogleAnalytics.trackEvent(category, action, label, value, newSession).then(() => {
                        // Do nothing
                    });
                });
            }, (error: any) => {
                this.eventNotSent.push({ category: category, action: action, label: label, newSession: newSession });
            });
        }
    }

    private trackEventNotSent(): Promise<{}> {
        return new Promise((resolve) => {
            if (this.eventNotSent == null || Object.keys(this.eventNotSent).length === 0) {
                resolve();
            } else {
                let promises = new Array();

                for (let i: number = 0; i < this.eventNotSent.length; i++) {
                    promises.push(GoogleAnalytics.trackEvent(
                        this.eventNotSent[i].category,
                        this.eventNotSent[i].action,
                        this.eventNotSent[i].label,
                        this.eventNotSent[i].value,
                        this.eventNotSent[i].newSession));
                }

                Observable.forkJoin(promises).subscribe(
                    (data: any) => {
                        this.eventNotSent = new Array();
                        resolve();
                    });
            }
        });
    }

    private initGoogleAnalytics(): Promise<{}> {
        return new Promise((resolve, reject) => {
            if (this.trackerInitialized) {
                resolve();
            } else {
                // console.log("startTrackerWithId");
                GoogleAnalytics.startTrackerWithId('UA-87867313-1').then(() => {
                    // console.log("enableUncaughtExceptionReporting");
                    // GoogleAnalytics.enableUncaughtExceptionReporting(true)
                    //     .then((success) => {
                    //         console.log("ga success:", success)
                    //     })
                    //     .catch((error) => {
                    //         console.log("ga error:", error)
                    //     })
                    this.trackerInitialized = true;
                    resolve();
                }).catch((error: any) => {
                    // Do nothing
                    this.trackerInitialized = false;
                    reject(error);
                });
            }
        });
    }
}
