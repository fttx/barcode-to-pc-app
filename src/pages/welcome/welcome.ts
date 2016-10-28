import { Component } from '@angular/core';
import { NavController } from 'ionic-angular';
import { Slides, ViewController } from 'ionic-angular';
import { ViewChild, NgZone } from '@angular/core';
import { TabsPage } from '../tabs/tabs';
import { ServerProvider } from '../../providers/server'
import { Settings } from '../../providers/settings'
import { ServerModel } from '../../models/server.model'

/*
  Generated class for the Welcome page.

  See http://ionicframework.com/docs/v2/components/#navigation for more info on
  Ionic pages and navigation.
*/
@Component({
  selector: 'page-welcome',
  templateUrl: 'welcome.html'
})
export class WelcomePage {
  @ViewChild('welcome') slider: Slides;
  public showNext = true;
  public connecting = true;

  slides = [{
    title: "Welcome to<br>Barcode to PC Wi-Fi remote!",
    description: "Let's connect to the PC and turn your smartphone in a real barcode scanner.",
    image: "assets/welcome/a5fsa.jpg",
    showNext: true,
  }, {
    title: "Download server",
    description: "Download Barcode to PC server from <span class='link'>barcode2pc.io</span> and install it to your computer",
    image: "assets/welcome/asd54a.png",
    showNext: true,
  }];

  constructor(
    public navCtrl: NavController,
    private serverProvider: ServerProvider,
    public viewCtrl: ViewController,
    private settings: Settings,
    private ngZone: NgZone
  ) { }

  ionViewDidLoad() {
    this.viewCtrl.willLeave.subscribe(() => {
      this.serverProvider.unwatch();
    })

    setTimeout(() => {
      this.serverProvider.watchForServers().subscribe((server: ServerModel) => {
        this.serverProvider.unwatch();
        this.settings.setDefaultServer(server);
        this.slider.slideTo(this.slider.length() - 1);
        this.ngZone.run(() => {
          this.connecting = false;
          this.showNext = false;
        });
      });
    }, 3000)

  }

  onNextClicked() {
    this.slider.slideNext();
  }
  startScanningClicked() {
    this.navCtrl.setRoot(TabsPage);
  }

  onSlideChanged() {
    let currentIndex = this.slider.getActiveIndex();
    if (currentIndex < this.slides.length) {
      this.showNext = this.slides[currentIndex].showNext;
    } else {
      this.showNext = false;
    }
  }



}
