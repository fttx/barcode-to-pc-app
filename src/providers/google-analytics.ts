import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GoogleAnalytics } from 'ionic-native'

declare var window: any;

@Injectable()
export class GoogleAnalyticsService {

    viewNotSent: any[] = new Array();
    eventNotSent: any[] = new Array();
    trackerInitialized: boolean = false;

    trackView(viewName: string) {
        if (typeof window.analytics == typeof undefined) {
            this.viewNotSent.push({ viewName: viewName });
        } else {
            this.initGoogleAnalytics().then(() => {
                this.trackViewNotSent().then(() => {
                    GoogleAnalytics.trackView(viewName).then(() => {
                        // Do nothing
                        console.log("trackView: ", viewName)
                    });
                });
            }, (error: any) => {
                this.viewNotSent.push({ viewName: viewName });
            });
        }
    }

    private trackViewNotSent(): Promise<{}> {
        return new Promise((resolve) => {
            if (!this.viewNotSent.length) {
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


    trackEvent(category: string, action: string, label: string = null, value: number = 0, newSession: boolean = false) {
        if (typeof window.analytics == typeof undefined) {
            this.eventNotSent.push({ category: category, action: action, label: label, newSession: newSession });
        } else {
            this.initGoogleAnalytics().then(() => {
                this.trackEventNotSent().then(() => {
                    GoogleAnalytics.trackEvent(category, action, label, value, newSession).then(() => {
                        // Do nothing
                        console.log("trackEvent: ", action)                        
                    });
                });
            }, (error: any) => {
                this.eventNotSent.push({ category: category, action: action, label: label, newSession: newSession });
            });
        }
    }

    private trackEventNotSent(): Promise<{}> {
        return new Promise((resolve) => {
            if (!this.eventNotSent.length) {
                resolve();
            } else {
                let promises = new Array();

                for (let i: number = 0; i < this.eventNotSent.length; i++) {
                    promises.push(GoogleAnalytics.trackEvent(
                        this.eventNotSent[i].category,
                        this.eventNotSent[i].action,
                        this.eventNotSent[i].label,
                        this.eventNotSent[i].value,
                        this.eventNotSent[i].newSession,
                    ));
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
        console.log('initGoogleAnalytics');
        return new Promise((resolve, reject) => {
            if (this.trackerInitialized) {
                resolve();
            } else {
                console.log("startTrackerWithId");
                GoogleAnalytics.startTrackerWithId('UA-87867313-1').then(() => {
                    console.log("enableUncaughtExceptionReporting");
                    GoogleAnalytics.enableUncaughtExceptionReporting(true)
                        .then((_success) => {
                            console.log("ERROR _success:", _success)
                        })
                        .catch((_error) => {
                            console.log("ERROR _error:", _error)
                        })


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