import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Company,
  Contract,
  CostCenter,
  OrgUnit,
  PurchaseOrder,
  SpendCategory,
  Supplier,
  ToleranceProfile
} from '../models/invoice.model';
import { CreateSupplierRequest } from '../models/supplier-registration.model';

export interface ProcurementMasterData {
  categories: SpendCategory[];
  suppliers: Supplier[];
  contracts: Contract[];
  purchaseOrders: PurchaseOrder[];
  toleranceProfile: ToleranceProfile;
}

/** Estructura organizativa: sociedades, areas y centros de coste. */
export interface OrganizationMasterData {
  companies: Company[];
  orgUnits: OrgUnit[];
  costCenters: CostCenter[];
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
  private organization$?: Observable<OrganizationMasterData>;

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

  /**
   * Da de alta un proveedor y refresca la cache para que aparezca de inmediato
   * en los desplegables de la aplicacion.
   */
  createSupplier(payload: CreateSupplierRequest): Observable<Supplier> {
    return this.http
      .post<Supplier>(`${this.baseUrl}/suppliers`, payload)
      .pipe(tap(() => (this.masterData$ = undefined)));
  }

  /** Sociedades, areas y CECOs; se cachean porque son maestros estables. */
  loadOrganization(): Observable<OrganizationMasterData> {
    if (!this.organization$) {
      this.organization$ = forkJoin({
        companies: this.http.get<Company[]>(`${this.baseUrl}/companies`),
        orgUnits: this.http.get<OrgUnit[]>(`${this.baseUrl}/org-units`),
        costCenters: this.http.get<CostCenter[]>(`${this.baseUrl}/cost-centers`)
      }).pipe(shareReplay(1));
    }
    return this.organization$;
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
