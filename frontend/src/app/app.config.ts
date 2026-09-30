import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { provideApi } from '../generated/auth-api';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // The one interceptor, registered once.
    provideHttpClient(withInterceptors([authInterceptor])),
    // Generated auth client, pointed at the configured auth origin.
    provideApi(environment.authApiBase),
    provideRouter(routes)
  ]
};
