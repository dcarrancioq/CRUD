import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupplierReport } from '../models/supplier-report.model';

/**
 * Informe de proveedor (consumido vs presupuesto, seguimiento, desviaciones y alertas).
 * Se calcula en el backend sobre la base de datos para que el mismo informe sea
 * reproducible y no dependa de lo que el navegador tenga cargado.
 */
@Injectable({
  providedIn: 'root'
})
export class SupplierReportService {
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  constructor(private http: HttpClient) {}

  getAvailableYears(): Observable<number[]> {
    return this.http.get<number[]>(`${this.baseUrl}/years`);
  }

  getSupplierReport(supplierId: string, fiscalYear: number): Observable<SupplierReport> {
    const params = new HttpParams().set('year', fiscalYear);
    return this.http.get<SupplierReport>(`${this.baseUrl}/suppliers/${supplierId}`, { params });
  }
}
