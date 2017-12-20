import { Component } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';

import { GoogleAnalytics } from '@ionic-native/google-analytics';
import { InAppPurchase2, IAPProduct } from '@ionic-native/in-app-purchase-2';

@Component({
  selector: 'page-buy-pro',
  templateUrl: 'buy-pro.html',
})
export class BuyProPage {
  public product: IAPProduct;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private ga: GoogleAnalytics,
    private inAppPurchase2: InAppPurchase2,
  ) {
  }

  ionViewDidLoad() {
    this.product = this.inAppPurchase2.get("test_plan_1");
    this.inAppPurchase2.when("test_plan_1").updated(() => {
      console.log('updated')
    });

    this.inAppPurchase2.when("test_plan_1").approved((product) => {
      // download the feature
      console.log('approved, downloading paid content....')
      product.finish();
    });
  }

  ionViewWillUnload() {
    this.inAppPurchase2.off(() => {
      console.log('off')
    })
  }

  ionViewDidEnter() {
    this.ga.trackView("BuyProPage");
  }

  purchase() {
    console.log('purchase');
    this.inAppPurchase2.order("test_plan_1");
  }
}
