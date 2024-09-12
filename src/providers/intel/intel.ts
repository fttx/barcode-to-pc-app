import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Config } from '../config';

@Injectable()
export class IntelProvider {

  constructor(public http: HttpClient) {
    console.log('[intel] Hello IntelProvider Provider');
    this.init(); // Initialize to send any pending requests
  }

  // Initialize and send saved requests if any
  async init() {
    const savedRequests = JSON.parse(localStorage.getItem('savedRequests')) || [];
    if (savedRequests.length > 0) {
      for (const request of savedRequests) {
        await this.send(request.endPoint, request.data, false);
      }
      localStorage.removeItem('savedRequests'); // Clear saved requests after sending
    }
  }

  // Method to send an incentive email
  async incentiveEmail(email: string = null): Promise<any> {
    return this.send('incentive-email', { email: email });
  }
  async incentiveEmailDownload(email: string = null): Promise<any> {
    return this.send('incentive-email-download', { email: email });
  }

  // Private method to send HTTP requests and handle failures
  private async send(endPoint: string, data: any, retryWhenOnline: boolean = true): Promise<any> {
    try {
      const response = await this.http.post(Config.URL_INTEL + '/' + endPoint, data, { headers: { 'Content-Type': 'application/json' } }).toPromise();
      console.log('[intel] Request successful:', response);
      return response; // Return the response in case the caller needs it
    } catch (error) {
      console.error('Request failed:', error);
      if (retryWhenOnline) {
        this.saveRequest(endPoint, data); // Save the request to retry later
      }
      return Promise.reject(error); // Return a rejected promise to propagate the error
    }
  }

  // Helper method to save requests to localStorage
  private saveRequest(endPoint: string, data: any) {
    const savedRequests = JSON.parse(localStorage.getItem('savedRequests')) || [];
    savedRequests.push({ endPoint, data });
    localStorage.setItem('savedRequests', JSON.stringify(savedRequests));
  }
}
