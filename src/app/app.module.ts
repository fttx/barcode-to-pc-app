import { NgModule } from '@angular/core';
import { IonicApp, IonicModule } from 'ionic-angular';
import { MyApp } from './app.component';
import { AboutPage } from '../pages/about/about';
import { ContactPage } from '../pages/contact/contact';
import { ScanningsPage } from '../pages/scannings/scannings';
import { TabsPage } from '../pages/tabs/tabs';
import { ScanSessionPage } from '../pages/scan-session/scan-session';
import { CircleTextComponent } from '../components/circle-text';

@NgModule({
  declarations: [
    MyApp,
    AboutPage,
    ContactPage,
    ScanningsPage,
    TabsPage,
    ScanSessionPage,
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
    ScanningsPage,
    TabsPage,
    ScanSessionPage,    
  ],
  providers: []
})
export class AppModule { }
