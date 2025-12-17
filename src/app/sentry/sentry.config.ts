import * as Sentry from '@sentry/angular';
import { environment } from '../../environments/environment';

export const SENTRY_DSN = 'https://0e27cd565db657f3e44cdc750f2caba7@o4510546897862656.ingest.de.sentry.io/4510546901663824';

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: environment.production ? 'production' : 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 1.0,
    tracePropagationTargets: ['localhost', /^https:\/\/.*$/],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
