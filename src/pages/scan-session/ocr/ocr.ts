import { Component, ElementRef, ViewChild } from '@angular/core';
import { Camera, CameraOptions } from '@ionic-native/camera';
import { AlertController, NavController, NavParams, Platform, ViewController } from 'ionic-angular';
import { Subscription } from 'rxjs';
import { Settings } from '../../../providers/settings';
declare var window: any;

@Component({
  selector: 'page-ocr',
  templateUrl: 'ocr.html',
})
export class OcrPage {
  @ViewChild('canvas') canvasEl: ElementRef;
  // OCR
  private resizeSubscription: Subscription = null;
  public imageFilePath: string = null;
  public ocrResult = null;
  private offsetY: number;
  private offsetX: number;
  private scale: number;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public viewCtrl: ViewController,
    public camera: Camera,
    public settings: Settings,
    public platform: Platform,
    public alertCtrl: AlertController,
  ) {
  }

  ionViewDidLoad() { console.log('ionViewDidLoad OcrPage'); }

  ionViewDidEnter() {
    this.resizeSubscription = this.platform.resize.subscribe(() => {
      if (this.imageFilePath != null && this.ocrResult != null) {
        this.renderOCRResult();
      }
    });
    this.start();
  }

  ionViewDidLeave() {
    if (this.resizeSubscription != null && this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
  }

  public async start() {
    this.resetCanvas();

    const cameraOptions: CameraOptions = {
      quality: 100,
      destinationType: this.camera.DestinationType.FILE_URI,
      saveToPhotoAlbum: false,
      correctOrientation: false,
      cameraDirection: (await this.settings.getPreferFrontCamera()) ? 1 : 0,
      // allowEdit: true,
      encodingType: this.camera.EncodingType.JPEG,
      mediaType: this.camera.MediaType.PICTURE,
    }

    try {
      this.imageFilePath = await this.camera.getPicture(cameraOptions);
    } catch {
      this.viewCtrl.dismiss(null);
      return;
    }

    window.textocr.recText(0 /* NORMFILEURI */, this.imageFilePath, (ocrResult) => {
      this.ocrResult = ocrResult;
      if (ocrResult.foundText) {
        this.renderOCRResult();
      } else {
        this.alertCtrl.create({
          title: 'No text found',
          message: 'Cannot find any text on the captured image',
          buttons: ['Cancel', { text: 'Try again', handler: () => { this.start() } }],
        }).present();
      }
    }), (ocrErr) => {
      this.viewCtrl.dismiss(null);
    };
  }

  private resetCanvas() {
    let canvas = this.canvasEl.nativeElement;
    canvas.width = this.platform.width();
    canvas.height = this.platform.height();
  }

  private renderOCRResult() {
    if (!this.ocrResult.foundText) return;

    let canvas = this.canvasEl.nativeElement;

    this.resetCanvas();
    let ctx = canvas.getContext('2d');

    let image = new Image;
    let that = this;
    image.onload = function () {
      // Set the captured image as background
      let img: any = this;
      that.scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      that.offsetX = (canvas.width / 2) - (img.width / 2) * that.scale;
      that.offsetY = (canvas.height / 2) - (img.height / 2) * that.scale;
      ctx.drawImage(img, that.offsetX, that.offsetY, img.width * that.scale, img.height * that.scale);

      // Draw bounding boxes and labels
      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ff0000';
      ctx.fillStyle = 'red';
      let lineIndex = 0, fontSize = 15, paddingTop = 30;
      that.ocrResult.lines.linepoints.forEach(rectangle => {
        let keys = Object.keys(rectangle);
        // For each two (x,y) points we draw a line
        // We start drawing from the up-left corner
        for (let i = 0; i <= 8; i += 2) { // 0 2 4 8
          let x1 = rectangle[keys[i % 8]] * that.scale + that.offsetX;
          let y1 = rectangle[keys[i + 1]] * that.scale + that.offsetY;
          let x2 = rectangle[keys[(i + 2) % 8]] * that.scale + that.offsetX;
          let y2 = rectangle[keys[(i + 3) % 8]] * that.scale + that.offsetY
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          // Compute the font parameters based on the 2nd line length (right side of the rectangle)
          if (i == 2) {
            let dx = x2 - x1;
            let dy = y2 - y1;
            let rectSideLength = Math.sqrt(dx * dx + dy * dy);
            fontSize = rectSideLength + 10;
            paddingTop = fontSize;
          }
          // draw the label only for the 3nd (i = 4) line
          if (i == 4) that.putTextAboveLine(ctx, that.ocrResult.lines.linetext[lineIndex++], x2, x1, y2, y1, paddingTop, fontSize)
        } // for
      });
      ctx.stroke();
    }; // image.onload
    image.src = window.Ionic.WebView.convertFileSrc(this.imageFilePath); // converts file:///... to http://localhost/...
  } // renderOCRResult

  onCanvasTouchEnd(event) {
    if (!this.ocrResult.foundText) return;

    let px = event.changedTouches[0].pageX, py = event.changedTouches[0].pageY;
    // Detect if the touch is inside the rectangle
    // See here: https://stackoverflow.com/a/17146376/824963
    let triangleArea = (Ax, Ay, Bx, By, Cx, Cy) => { return Math.abs((Bx * Ay - Ax * By) + (Cx * By - Bx * Cy) + (Ax * Cy - Cx * Ay)) / 2 };

    // Foreach rectangle
    for (let r = 0; r < this.ocrResult.lines.linepoints.length; r++) {
      let rectangle = this.ocrResult.lines.linepoints[r];

      let keys = Object.keys(rectangle);
      let triangleAreas = 0,
        ab, bc, rectangleArea;

      for (let i = 0; i <= 4; i += 2) { // 0 2 4
        let x1 = rectangle[keys[i % 8]] * this.scale + this.offsetX;
        let y1 = rectangle[keys[i + 1]] * this.scale + this.offsetY;
        let x2 = rectangle[keys[(i + 2) % 8]] * this.scale + this.offsetX;
        let y2 = rectangle[keys[(i + 3) % 8]] * this.scale + this.offsetY
        // Compute the triangles area sum
        triangleAreas += triangleArea(x1, y1, px, py, x2, y2);
        // Compute the rectangle area
        if (i == 0) ab = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (i == 2) bc = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      }
      rectangleArea = ab * bc;

      // Test if it's inside
      if (triangleAreas <= rectangleArea) {
        this.viewCtrl.dismiss(this.ocrResult.lines.linetext[r]);
        this.imageFilePath = null;
        this.ocrResult = null;
        return;
      }
    }
  } // onCanvasTouchEnd

  private putTextAboveLine(ctx: CanvasRenderingContext2D, text: string, x1: number, x2: number, y1: number, y2: number, paddingTop = 0, fontSize = 15) {
    let dx = x2 - x1, dy = y2 - y1, p = { x: x1, y: y1 }, pad = 1 / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.translate(p.x + dx * pad, p.y + dy * pad + paddingTop);
    ctx.rotate(Math.atan2(dy, dx));
    ctx.font = fontSize + 'px Arial';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
}
