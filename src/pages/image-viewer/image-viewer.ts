import { Component } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NavParams, ViewController, Platform } from 'ionic-angular';

@Component({
  selector: 'image-viewer',
  templateUrl: 'image-viewer.html'
})
export class ImageViewerPage {
  public imageBase64: string;
  public safeImageUrl: SafeUrl;
  private unregisterBackButton: any;

  constructor(
    private navParams: NavParams,
    private viewCtrl: ViewController,
    private sanitizer: DomSanitizer,
    private platform: Platform,
  ) {
    // Retrieve the base64 image string passed by the modal
    this.imageBase64 = this.navParams.get('imageBase64');
    this.safeImageUrl = this.sanitizer.bypassSecurityTrustUrl(this.imageBase64);
  }

  ionViewDidEnter() {
    this.unregisterBackButton = this.platform.registerBackButtonAction(() => {
      this.closeModal();
    });
  }

  ionViewWillLeave() {
    if (this.unregisterBackButton) {
      this.unregisterBackButton();
    }
  }

  closeModal() {
    this.viewCtrl.dismiss();
  }
}
