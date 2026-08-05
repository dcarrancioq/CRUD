import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConsolidationOpportunity,
  CreateInvoiceRequest,
  Invoice,
  InvoiceComparison,
  InvoiceException
} from '../models/invoice.model';

/**
 * Cliente del API de facturas. Toda la logica de clasificacion, tolerancias,
 * duplicados y riesgo vive en el backend (NestJS + PostgreSQL): el navegador
 * solo pinta el resultado, de modo que el mismo veredicto es reproducible y
 * auditable fuera de la sesion del usuario.
 */
@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly baseUrl = `${environment.apiUrl}/invoices`;

  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  invoices$ = this.invoicesSubject.asObservable();

  constructor(private http: HttpClient) {}

  getInvoices(): Invoice[] {
    return this.invoicesSubject.value;
  }

  getInvoice(id: string): Invoice | undefined {
    return this.getInvoices().find(invoice => invoice.id === id);
  }

  getOpenExceptions(): InvoiceException[] {
    return this.getInvoices()
      .flatMap(invoice => invoice.exceptions)
      .filter(exception => exception.status === 'open' || exception.status === 'in_review');
  }

  /** Carga (o recarga) el listado y lo publica en `invoices$`. */
  refresh(): Observable<Invoice[]> {
    return this.http
      .get<Invoice[]>(this.baseUrl)
      .pipe(tap(invoices => this.invoicesSubject.next(invoices)));
  }

  getConsolidationOpportunities(): Observable<ConsolidationOpportunity[]> {
    return this.http.get<ConsolidationOpportunity[]>(`${this.baseUrl}/consolidation-opportunities`);
  }

  /** Evalua la factura contra las tolerancias sin registrarla (panel en vivo del alta). */
  previewInvoice(request: CreateInvoiceRequest): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/preview`, request);
  }

  createInvoice(request: CreateInvoiceRequest): Observable<Invoice> {
    return this.http.post<Invoice>(this.baseUrl, request).pipe(tap(() => this.refresh().subscribe()));
  }

  resolveException(
    invoiceId: string,
    exceptionId: string,
    status: InvoiceException['status'],
    note?: string
  ): Observable<Invoice> {
    return this.http
      .patch<Invoice>(`${this.baseUrl}/${invoiceId}/exceptions/${exceptionId}`, { status, note })
      .pipe(tap(() => this.refresh().subscribe()));
  }

  compare(leftId: string, rightId: string): Observable<InvoiceComparison> {
    const params = new HttpParams().set('left', leftId).set('right', rightId);
    return this.http.get<InvoiceComparison>(`${this.baseUrl}/compare`, { params });
  }
}
