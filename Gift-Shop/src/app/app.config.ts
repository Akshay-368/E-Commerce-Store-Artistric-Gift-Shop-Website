import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideClientHydration, withEventReplay, withNoHttpTransferCache } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // FIX: Added withNoHttpTransferCache() so SSR does NOT cache/intercept HTTP calls
    // that the browser-side admin portal needs to make to the backend.
    // Without this, Angular's SSR hydration was swallowing admin API requests
    // made during server-side rendering (where localhost:5000 is unreachable),
    // causing the browser to never re-issue them.
    provideClientHydration(withEventReplay(), withNoHttpTransferCache()),
    // FIX: Added withInterceptorsFromDi() so any future HTTP interceptors (auth
    // token injection, error handling) registered via DI are picked up properly.
    provideHttpClient(withFetch(), withInterceptorsFromDi()),
  ]
};