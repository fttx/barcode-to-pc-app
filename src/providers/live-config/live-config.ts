import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import { Platform, Events, AlertController, ToastController, ModalController } from 'ionic-angular';
import { Config } from '../config';
import 'rxjs/add/operator/timeout';

/**
 * LiveConfigProvider
 *
 * Loads and runs remote JavaScript features from server.
 * Cached code runs forever until a new version is fetched.
 * Works offline - if server is down, uses last cached version.
 */
@Injectable()
export class LiveConfigProvider {
  private static readonly CONFIG_URL = 'https://static.barcodetopc.com/app-updates/v1/features.js';
  private static readonly CACHE_KEY = 'app_dynamic_features';
  private static readonly FETCH_TIMEOUT_MS = 10000; // 10 seconds

  private isEnabled: boolean = true;
  private isLoaded: boolean = false;

  constructor(
    private http: Http,
    private platform: Platform,
    private events: Events,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
  ) {
    console.log('LiveConfigProvider initialized');
    // Load enabled state from storage
    const stored = localStorage.getItem('live_features_enabled');
    if (stored !== null) {
      this.isEnabled = stored === 'true';
    }
  }

  /**
   * Initialize dynamic features
   * Loads cached code immediately, then ALWAYS fetches fresh code
   */
  public async init(): Promise<void> {
    if (!this.isEnabled) {
      console.log('[LiveConfig] Disabled, skipping');
      return;
    }

    if (this.isLoaded) {
      console.log('[LiveConfig] Already loaded, skipping');
      return;
    }

    try {
      console.log('[LiveConfig] Starting initialization...');

      // Load and run cached code immediately (if available)
      const cachedCode = this.loadFromCache();
      if (cachedCode) {
        console.log('[LiveConfig] Running cached code');
        this.loadCode(cachedCode);
      } else {
        console.log('[LiveConfig] No cached code found');
      }

      // ALWAYS fetch fresh code from server (updates cache if successful)
      await this.fetchAndUpdate();
    } catch (error) {
      console.error('[LiveConfig] Initialization error:', error);
    }
  }

  /**
   * Fetch fresh features and update cache
   * ALWAYS attempts to fetch - updates are pulled on every app startup
   * Uses cache-busting to bypass WebView HTTP cache
   */
  private async fetchAndUpdate(): Promise<void> {
    try {
      // Add random cache-busting parameter to bypass WebView cache
      const cacheBuster = Date.now() + Math.random().toString(36).substring(7);
      const url = `${LiveConfigProvider.CONFIG_URL}?_=${cacheBuster}`;

      console.log('[LiveConfig] Fetching fresh features from:', url);

      const response = await this.http
        .get(url)
        .timeout(LiveConfigProvider.FETCH_TIMEOUT_MS)
        .toPromise();

      const code = response.text();

      if (!code || code.trim().length === 0) {
        console.log('[LiveConfig] Empty response, skipping');
        return;
      }

      console.log('[LiveConfig] Fresh code fetched, length:', code.length);

      // Save to cache - this updates the cache with latest version
      this.saveToCache(code);
      console.log('[LiveConfig] Cache updated with fresh code');

    } catch (error) {
      console.error('[LiveConfig] Fetch failed (using cached code if available):', error);
      // Silent failure - cached code continues working
    }
  }

  /**
   * Execute the remote JavaScript code
   */
  private loadCode(code: string): void {
    try {
      console.log('[LiveConfig] Executing features...');

      // Create a safe execution context with access to app APIs
      const context = this.createSafeContext();

      // Create a function from the code and load it with the context
      const loadRemoteCode = new Function('context', code);
      loadRemoteCode(context);

      this.isLoaded = true;
      console.log('[LiveConfig] Code loadd successfully');

    } catch (error) {
      console.error('[LiveConfig] Loading error:', error);
      if (Config.DEBUG) {
        this.showError('Failed to load features: ' + error.message);
      }
    }
  }

  /**
   * Create context object with app APIs for features code
   */
  private createSafeContext(): any {
    const self = this;

    return {
      // Platform detection
      platform: {
        is: (platformName: string) => this.platform.is(platformName),
        platforms: () => this.platform.platforms(),
      },

      // Event system for subscribing to app events
      events: {
        subscribe: (topic: string, handler: Function) => {
          console.log('[LiveConfig] Event subscribed:', topic);
          return this.events.subscribe(topic, handler);
        },
        publish: (topic: string, ...args: any[]) => {
          this.events.publish(topic, ...args);
        },
      },

      // Show dialogs and messages
      ui: {
        alert: (title: string, message: string, buttons?: any) => {
          // Handle both string arrays ['OK', 'Cancel'] and button objects
          let buttonConfig = ['OK'];
          if (buttons) {
            if (Array.isArray(buttons)) {
              // Convert string array to button objects
              buttonConfig = buttons.map(text =>
                typeof text === 'string' ? { text: text } : text
              );
            } else {
              buttonConfig = buttons;
            }
          }

          const alert = self.alertCtrl.create({
            title: title,
            message: message,
            buttons: buttonConfig
          });
          alert.present();
          return alert;
        },

        toast: (message: string, duration: number = 3000) => {
          const toast = self.toastCtrl.create({
            message: message,
            duration: duration,
            position: 'bottom',
          });
          toast.present();
          return toast;
        },

        confirm: (title: string, message: string): Promise<boolean> => {
          return new Promise((resolve) => {
            const alert = self.alertCtrl.create({
              title: title,
              message: message,
              buttons: [
                {
                  text: 'Cancel',
                  role: 'cancel',
                  handler: () => resolve(false)
                },
                {
                  text: 'OK',
                  handler: () => resolve(true)
                }
              ]
            });
            alert.present();
          });
        },
      },

      // Persistent storage
      storage: {
        get: (key: string) => localStorage.getItem('liveconfig_' + key),
        set: (key: string, value: string) => localStorage.setItem('liveconfig_' + key, value),
        remove: (key: string) => localStorage.removeItem('liveconfig_' + key),
      },

      // Logging
      log: (...args: any[]) => console.log('[LiveFeatures]', ...args),

      // Delayed execution
      delay: (callback: Function, ms: number) => setTimeout(callback, ms),

      // Cordova plugins (for native features)
      cordova: window.cordova || null,

      // Direct window access (use carefully)
      window: window,
    };
  }

  /**
   * Load code from local cache
   * Cache never expires - code runs forever until updated
   */
  private loadFromCache(): string | null {
    try {
      const cachedCode = localStorage.getItem(LiveConfigProvider.CACHE_KEY);

      if (!cachedCode) {
        console.log('[LiveConfig] No cached code found');
        return null;
      }

      console.log('[LiveConfig] Found cached code');
      return cachedCode;
    } catch (error) {
      console.error('[LiveConfig] Cache load error:', error);
      return null;
    }
  }

  /**
   * Save code to local cache
   */
  private saveToCache(code: string): void {
    try {
      localStorage.setItem(LiveConfigProvider.CACHE_KEY, code);
      console.log('[LiveConfig] Saved to cache');
    } catch (error) {
      console.error('[LiveConfig] Cache save error:', error);
    }
  }

  /**
   * Clear cached features
   * Removes stored code and resets state - next app launch will fetch fresh
   */
  public clearCache(): void {
    try {
      localStorage.removeItem(LiveConfigProvider.CACHE_KEY);
      this.isLoaded = false;
      console.log('[LiveConfig] Cache cleared successfully');
    } catch (error) {
      console.error('[LiveConfig] Error clearing cache:', error);
    }
  }

  /**
   * Force refresh features from server
   */
  public async forceRefresh(): Promise<void> {
    console.log('[LiveConfig] Force refresh requested');
    this.isLoaded = false;
    await this.fetchAndUpdate();
  }

  /**
   * Enable/disable live features
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    localStorage.setItem('live_features_enabled', enabled ? 'true' : 'false');
    console.log('[LiveConfig] Enabled:', enabled);
  }

  /**
   * Check if live features are enabled
   */
  public isFeatureEnabled(): boolean {
    const stored = localStorage.getItem('live_features_enabled');
    if (stored === null) {
      return true; // Enabled by default
    }
    return stored === 'true';
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    const toast = this.toastCtrl.create({
      message: message,
      duration: 5000,
      position: 'bottom',
      showCloseButton: true,
    });
    toast.present();
  }
}
