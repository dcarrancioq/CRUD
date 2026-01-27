import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ApiError {
  status: number;
  message: string;
  errors?: { [key: string]: string[] };
}

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        const apiError: ApiError = {
          status: error.status,
          message: this.getErrorMessage(error),
          errors: error.error?.errors
        };

        console.error('API Error:', apiError);
        return throwError(() => apiError);
      })
    );
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error instanceof ErrorEvent) {
      return error.error.message;
    }

    switch (error.status) {
      case 0:
        return 'No se pudo conectar con el servidor. Verifique su conexion a internet.';
      case 400:
        return error.error?.message || 'Solicitud invalida.';
      case 401:
        return 'No autorizado. Por favor inicie sesion.';
      case 403:
        return 'No tiene permisos para realizar esta accion.';
      case 404:
        return 'Recurso no encontrado.';
      case 409:
        return error.error?.message || 'Conflicto con el estado actual del recurso.';
      case 422:
        return error.error?.message || 'Error de validacion.';
      case 429:
        return 'Demasiadas solicitudes. Por favor espere un momento.';
      case 500:
        return 'Error interno del servidor. Por favor intente mas tarde.';
      case 503:
        return 'Servicio no disponible. Por favor intente mas tarde.';
      default:
        return error.error?.message || 'Ha ocurrido un error inesperado.';
    }
  }
}
