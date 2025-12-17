import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { initSentry } from './app/sentry';

initSentry();

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));
