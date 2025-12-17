import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/angular';

@Injectable()
export class SentryHttpInterceptor implements HttpInterceptor {
  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        this.captureHttpError(error, request);
        return throwError(() => error);
      })
    );
  }

  private captureHttpError(error: HttpErrorResponse, request: HttpRequest<unknown>): void {
    Sentry.withScope((scope) => {
      scope.setTag('type', 'http');
      scope.setTag('http.method', request.method);
      scope.setTag('http.url', request.url);
      scope.setTag('http.status_code', error.status.toString());

      scope.setContext('HTTP Request', {
        method: request.method,
        url: request.url,
        headers: this.sanitizeHeaders(request.headers),
      });

      scope.setContext('HTTP Response', {
        status: error.status,
        statusText: error.statusText,
        message: error.message,
        error: error.error,
      });

      const errorMessage = `HTTP Error ${error.status}: ${request.method} ${request.url}`;
      Sentry.captureException(new Error(errorMessage));
    });
  }

  private sanitizeHeaders(headers: { keys(): string[]; get(name: string): string | null }): Record<string, string | null> {
    const sanitized: Record<string, string | null> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token'];

    headers.keys().forEach((key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = headers.get(key);
      }
    });

    return sanitized;
  }
}
