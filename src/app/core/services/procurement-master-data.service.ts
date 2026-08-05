import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Contract,
  PurchaseOrder,
  SpendCategory,
  Supplier,
  ToleranceProfile
} from '../models/invoice.model';

export interface ProcurementMasterData {
  categories: SpendCategory[];
  suppliers: Supplier[];
  contracts: Contract[];
  purchaseOrders: PurchaseOrder[];
  toleranceProfile: ToleranceProfile;
}

/**
 * Maestros de compras (categorias de gasto, proveedores con sus cuentas bancarias,
 * contratos, pedidos y perfil de tolerancias) servidos por el backend.
 * Se cachean con `shareReplay` porque cambian con poca frecuencia.
 */
@Injectable({
  providedIn: 'root'
})
export class ProcurementMasterDataService {
  private readonly baseUrl = `${environment.apiUrl}/master-data`;
  private masterData$?: Observable<ProcurementMasterData>;

  constructor(private http: HttpClient) {}

  load(): Observable<ProcurementMasterData> {
    if (!this.masterData$) {
      this.masterData$ = forkJoin({
        categories: this.http.get<SpendCategory[]>(`${this.baseUrl}/categories`),
        suppliers: this.http.get<Supplier[]>(`${this.baseUrl}/suppliers`),
        contracts: this.http.get<Contract[]>(`${this.baseUrl}/contracts`),
        purchaseOrders: this.http.get<PurchaseOrder[]>(`${this.baseUrl}/purchase-orders`),
        toleranceProfile: this.http.get<ToleranceProfile>(`${this.baseUrl}/tolerance-profile`)
      }).pipe(shareReplay(1));
    }
    return this.masterData$;
  }

  getSuppliers(): Observable<Supplier[]> {
    return this.load().pipe(map(data => data.suppliers));
  }

  getCategories(): Observable<SpendCategory[]> {
    return this.load().pipe(map(data => data.categories));
  }

  getToleranceProfile(): Observable<ToleranceProfile> {
    return this.load().pipe(map(data => data.toleranceProfile));
  }
}
