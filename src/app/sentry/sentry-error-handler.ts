import { ErrorHandler, Injectable } from '@angular/core';
import * as Sentry from '@sentry/angular';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const extractedError = this.extractError(error);

    Sentry.captureException(extractedError, {
      mechanism: {
        type: 'angular',
        handled: false,
      },
    });

    console.error('Error captured by Sentry:', extractedError);
  }

  private extractError(error: unknown): Error | string {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'object' && error !== null) {
      const errorObj = error as { rejection?: unknown; originalError?: unknown };
      if (errorObj.rejection instanceof Error) {
        return errorObj.rejection;
      }
      if (errorObj.originalError instanceof Error) {
        return errorObj.originalError;
      }
    }

    if (typeof error === 'string') {
      return error;
    }

    return String(error);
  }
}
