import { NgModule } from '@angular/core';
import { IonicApp, IonicModule } from 'ionic-angular';
import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { ScanSessionsPage } from '../pages/scan-sessions/scan-sessions';
import { TabsPage } from '../pages/tabs/tabs';
import { WelcomePage } from '../pages/welcome/welcome';
import { ScanSessionPage } from '../pages/scan-session/scan-session';
import { SelectServerPage } from '../pages/select-server/select-server';
import { CircleTextComponent } from '../components/circle-text';
import { ServerProvider } from '../providers/server'
import { Settings } from '../providers/settings'
import { Storage } from '@ionic/storage';

@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ContactPage,
    ScanSessionsPage,
    TabsPage,
    WelcomePage,
    ScanSessionPage,
    SelectServerPage,
    CircleTextComponent
  ],
  imports: [
    IonicModule.forRoot(MyApp)
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    AboutPage,
    ContactPage,
    ScanSessionsPage,
    SelectServerPage,
    TabsPage,
    WelcomePage,
    ScanSessionPage,
  ],
  providers: [ServerProvider, Storage, Settings]
})
export class AppModule { }
