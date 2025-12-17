import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/angular';
import { Tutorial } from '../models/tutorial.model';

const baseUrl = 'http://localhost:8080/api/tutorials';

@Injectable({
  providedIn: 'root',
})
export class TutorialService {
  constructor(private http: HttpClient) {}

  getAll(): Observable<Tutorial[]> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: 'Fetching all tutorials',
      level: 'info',
    });
    return this.http.get<Tutorial[]>(baseUrl).pipe(
      catchError((error) => this.handleError(error, 'getAll'))
    );
  }

  get(id: string | number): Observable<Tutorial> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: `Fetching tutorial with id: ${id}`,
      level: 'info',
    });
    return this.http.get<Tutorial>(`${baseUrl}/${id}`).pipe(
      catchError((error) => this.handleError(error, 'get'))
    );
  }

  create(data: Partial<Tutorial>): Observable<Tutorial> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: 'Creating new tutorial',
      level: 'info',
      data: { title: data.title },
    });
    return this.http.post<Tutorial>(baseUrl, data).pipe(
      catchError((error) => this.handleError(error, 'create'))
    );
  }

  update(id: string | number | undefined, data: Partial<Tutorial>): Observable<{ message?: string } & Tutorial> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: `Updating tutorial with id: ${id}`,
      level: 'info',
    });
    return this.http.put<{ message?: string } & Tutorial>(`${baseUrl}/${id}`, data).pipe(
      catchError((error) => this.handleError(error, 'update'))
    );
  }

  delete(id: string | number | undefined): Observable<void> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: `Deleting tutorial with id: ${id}`,
      level: 'info',
    });
    return this.http.delete<void>(`${baseUrl}/${id}`).pipe(
      catchError((error) => this.handleError(error, 'delete'))
    );
  }

  deleteAll(): Observable<void> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: 'Deleting all tutorials',
      level: 'warning',
    });
    return this.http.delete<void>(baseUrl).pipe(
      catchError((error) => this.handleError(error, 'deleteAll'))
    );
  }

  findByTitle(title: string): Observable<Tutorial[]> {
    Sentry.addBreadcrumb({
      category: 'tutorial',
      message: `Searching tutorials by title: ${title}`,
      level: 'info',
    });
    return this.http.get<Tutorial[]>(`${baseUrl}?title=${title}`).pipe(
      catchError((error) => this.handleError(error, 'findByTitle'))
    );
  }

  private handleError(error: unknown, operation: string): Observable<never> {
    Sentry.withScope((scope) => {
      scope.setTag('operation', operation);
      scope.setTag('service', 'TutorialService');
      scope.setContext('Error Details', {
        operation,
        error,
      });
      Sentry.captureException(error);
    });

    console.error(`TutorialService.${operation} error:`, error);
    return throwError(() => error);
  }
}
