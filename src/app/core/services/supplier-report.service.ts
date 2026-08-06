import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupplierReport } from '../models/supplier-report.model';
import {
  AnalyticsFilters,
  ProcurementAnalyticsReport,
  SupplierDirectoryRow
} from '../models/procurement-analytics.model';

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

  getSupplierReport(
    supplierId: string,
    fiscalYear: number,
    dimensions: { companyId?: string; orgUnitId?: string; categoryCode?: string } = {}
  ): Observable<SupplierReport> {
    let params = new HttpParams().set('year', fiscalYear);
    if (dimensions.companyId) {
      params = params.set('companyId', dimensions.companyId);
    }
    if (dimensions.orgUnitId) {
      params = params.set('orgUnitId', dimensions.orgUnitId);
    }
    if (dimensions.categoryCode) {
      params = params.set('categoryCode', dimensions.categoryCode);
    }
    return this.http.get<SupplierReport>(`${this.baseUrl}/suppliers/${supplierId}`, { params });
  }

  /** Cuadro de mando de compras: presupuesto, consumo, compromisos y desviaciones. */
  getAnalytics(filters: AnalyticsFilters): Observable<ProcurementAnalyticsReport> {
    let params = new HttpParams()
      .set('year', filters.fiscalYear)
      .set('period', filters.period);
    if (filters.companyId) {
      params = params.set('companyId', filters.companyId);
    }
    if (filters.orgUnitId) {
      params = params.set('orgUnitId', filters.orgUnitId);
    }
    if (filters.categoryCode) {
      params = params.set('categoryCode', filters.categoryCode);
    }
    if (filters.supplierId) {
      params = params.set('supplierId', filters.supplierId);
    }
    return this.http.get<ProcurementAnalyticsReport>(`${this.baseUrl}/analytics`, { params });
  }

  /** Listado de proveedores con sus sociedades, areas y contratos asociados. */
  getSupplierDirectory(search?: string): Observable<SupplierDirectoryRow[]> {
    let params = new HttpParams();
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<SupplierDirectoryRow[]>(`${this.baseUrl}/suppliers/directory`, { params });
  }
}
