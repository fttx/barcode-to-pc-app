import { Component } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { NavParams, ViewController } from 'ionic-angular';

@Component({
  selector: 'image-viewer',
  templateUrl: 'image-viewer.html'
})
export class ImageViewerPage {
  public imageBase64: string;
  public safeImageUrl: SafeUrl;

  constructor(
    private navParams: NavParams,
    private viewCtrl: ViewController,
    private sanitizer: DomSanitizer,
  ) {
    // Retrieve the base64 image string passed by the modal
    this.imageBase64 = this.navParams.get('imageBase64');
    this.safeImageUrl = this.sanitizer.bypassSecurityTrustUrl(this.imageBase64);
  }

  closeModal() {
    this.viewCtrl.dismiss();
  }
}
