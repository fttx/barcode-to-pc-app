import { Component } from '@angular/core';
import { NavController, AlertController, ToastController } from 'ionic-angular';
import { LiveConfigProvider } from '../../providers/live-config/live-config';
import { Config } from '../../providers/config';

@Component({
  selector: 'page-advanced-settings',
  templateUrl: 'advanced-settings.html'
})
export class AdvancedSettingsPage {
  public configUrl: string = '';
  public cacheStatus: string = '';
  public isEnabled: boolean = true;

  constructor(
    public navCtrl: NavController,
    private liveConfig: LiveConfigProvider,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
  ) {
    this.configUrl = Config.URL_LIVE_FEATURES || 'https://static.barcodetopc.com/app-updates/v1/features.js';
  }

  ionViewDidEnter() {
    this.updateStatus();
  }

  updateStatus() {
    const cachedCode = localStorage.getItem('app_dynamic_features');

    if (cachedCode) {
      this.cacheStatus = `${(cachedCode.length / 1024).toFixed(2)} KB cached`;
    } else {
      this.cacheStatus = 'No cached code';
    }

    // Update enabled state
    this.isEnabled = this.liveConfig.isFeatureEnabled();
  }

  toggleEnabled() {
    this.liveConfig.setEnabled(this.isEnabled);
    const toast = this.toastCtrl.create({
      message: this.isEnabled ? 'Live features enabled' : 'Live features disabled',
      duration: 2000,
      position: 'bottom'
    });
    toast.present();
  }

  async forceRefresh() {
    const alert = this.alertCtrl.create({
      title: 'Force Refresh',
      message: 'Fetch fresh code from server?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Refresh',
          handler: () => {
            this.liveConfig.forceRefresh().then(() => {
              const toast = this.toastCtrl.create({
                message: 'Code refreshed successfully!',
                duration: 2000,
                position: 'bottom'
              });
              toast.present();
              this.updateStatus();
            }).catch(error => {
              const toast = this.toastCtrl.create({
                message: 'Refresh failed (cached code still works)',
                duration: 3000,
                position: 'bottom'
              });
              toast.present();
            });
          }
        }
      ]
    });
    alert.present();
  }

  clearCache() {
    const alert = this.alertCtrl.create({
      title: 'Clear Cache',
      message: 'This will remove all cached code. Fresh code will be downloaded on next app launch.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Clear',
          handler: () => {
            this.liveConfig.clearCache();
            const toast = this.toastCtrl.create({
              message: 'Cache cleared. Restart app to fetch fresh code.',
              duration: 3000,
              position: 'bottom'
            });
            toast.present();
            this.updateStatus();
          }
        }
      ]
    });
    alert.present();
  }

  viewCachedCode() {
    const cachedCode = localStorage.getItem('app_dynamic_features');
    if (!cachedCode) {
      const toast = this.toastCtrl.create({
        message: 'No cached code',
        duration: 2000,
        position: 'bottom'
      });
      toast.present();
      return;
    }

    const alert = this.alertCtrl.create({
      title: 'Cached Code',
      message: `<pre style="font-size: 10px; max-height: 300px; overflow-y: auto;">${this.escapeHtml(cachedCode.substring(0, 1000))}${cachedCode.length > 1000 ? '\n\n...(truncated)' : ''}</pre>`,
      buttons: ['Close']
    });
    alert.present();
  }

  private escapeHtml(text: string): string {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}
