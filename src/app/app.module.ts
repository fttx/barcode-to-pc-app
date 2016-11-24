import { NgModule } from '@angular/core';
import { IonicApp, IonicModule } from 'ionic-angular';
import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { EditScanSessionPage } from '../pages/scan-session/edit-scan-session/edit-scan-session';
import { WelcomePage } from '../pages/welcome/welcome';
import { ScanSessionPage } from '../pages/scan-session/scan-session';
import { SelectServerPage } from '../pages/select-server/select-server';
import { CircleTextComponent } from '../components/circle-text';
import { ServerProvider } from '../providers/server'
import { Settings } from '../providers/settings'
import { GoogleAnalyticsService } from '../providers/google-analytics'
import { ScanSessionsStorage } from '../providers/scan-sessions-storage'
import { Storage } from '@ionic/storage';
import { MomentModule } from 'angular2-moment';

@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ScanSessionsPage,
    EditScanSessionPage,
    WelcomePage,
    ScanSessionPage,
    SelectServerPage,
    CircleTextComponent
  ],
  imports: [
    IonicModule.forRoot(MyApp),
    MomentModule
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    AboutPage,
    ScanSessionsPage,
    SelectServerPage,
    EditScanSessionPage,
    WelcomePage,
    ScanSessionPage,
  ],
  providers: [ServerProvider, Storage, Settings, ScanSessionsStorage, GoogleAnalyticsService]
})
export class AppModule { }
