import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { SupplierDirectoryRow } from '../../../../core/models/procurement-analytics.model';
import { SupplierReportService } from '../../../../core/services/supplier-report.service';

/**
 * Listado de proveedores con las sociedades y areas de la compania a las que
 * estan asociados (por imputacion de facturas y por ambito de sus contratos) y
 * los contratos vigentes de cada uno.
 */
@Component({
  selector: 'app-supplier-directory',
  templateUrl: './supplier-directory.component.html',
  styleUrls: ['./supplier-directory.component.css']
})
export class SupplierDirectoryComponent implements OnInit, OnDestroy {
  suppliers: SupplierDirectoryRow[] = [];
  search = '';
  loading = false;
  errorMessage = '';
  expandedSupplierId = '';

  private readonly searchTrigger = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(private reports: SupplierReportService) {}

  ngOnInit(): void {
    this.searchTrigger
      .pipe(
        debounceTime(300),
        switchMap(term => this.reports.getSupplierDirectory(term || undefined)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: suppliers => {
          this.suppliers = suppliers;
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'No se ha podido cargar el listado de proveedores.';
        }
      });

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.searchTrigger.next(this.search.trim());
  }

  toggle(supplierId: string): void {
    this.expandedSupplierId = this.expandedSupplierId === supplierId ? '' : supplierId;
  }

  /** Sociedades distintas a las que el proveedor factura o tiene contrato. */
  companyNames(supplier: SupplierDirectoryRow): string {
    return supplier.companies.map(scope => scope.companyName).join(', ') || 'Sin imputacion registrada';
  }

  orgUnitNames(supplier: SupplierDirectoryRow): string {
    const units = new Set(supplier.companies.flatMap(scope => scope.orgUnits));
    return units.size ? [...units].join(', ') : 'Sin area registrada';
  }

  contractStatusClass(status: string): string {
    return status === 'active' ? 'status-active' : status === 'expired' ? 'status-expired' : 'status-draft';
  }
}
