import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { SupplierDirectoryRow } from '../../../../core/models/procurement-analytics.model';
import { SupplierReportService } from '../../../../core/services/supplier-report.service';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { SortValue, TableSortState } from '../../../../shared/utils/table-sort';

type DirectorySortField =
  | 'legalName'
  | 'taxId'
  | 'riskScore'
  | 'companies'
  | 'orgUnits'
  | 'contractCount'
  | 'consumedAmount'
  | 'invoiceCount'
  | 'bankAccountsPendingVerification';

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
  companyFilter = '';
  orgUnitFilter = '';
  categoryFilter = '';
  bankStatusFilter = '';
  loading = false;
  errorMessage = '';
  expandedSupplierId = '';

  readonly sort = new TableSortState<DirectorySortField>('legalName', 'asc');

  readonly bankStatusOptions: SearchableOption[] = [
    { value: 'pending', label: 'Con cuentas pendientes' },
    { value: 'verified', label: 'Solo cuentas verificadas' }
  ];

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

  /** Opciones de filtro derivadas del propio listado cargado. */
  get companyOptions(): SearchableOption[] {
    const names = new Set(this.suppliers.flatMap(row => row.companies.map(scope => scope.companyName)));
    return [...names].sort().map(name => ({ value: name, label: name }));
  }

  get orgUnitOptions(): SearchableOption[] {
    const names = new Set(this.suppliers.flatMap(row => row.companies.flatMap(scope => scope.orgUnits)));
    return [...names].sort().map(name => ({ value: name, label: name }));
  }

  get categoryOptions(): SearchableOption[] {
    const codes = new Set(this.suppliers.flatMap(row => row.categories));
    return [...codes].sort().map(code => ({ value: code, label: code }));
  }

  get visibleSuppliers(): SupplierDirectoryRow[] {
    const filtered = this.suppliers.filter(row => this.matches(row));
    return this.sort.sort(filtered, (supplier, field) => this.sortValue(supplier, field));
  }

  sortBy(field: string): void {
    this.sort.toggle(field as DirectorySortField);
  }

  clearFilters(): void {
    this.search = '';
    this.companyFilter = '';
    this.orgUnitFilter = '';
    this.categoryFilter = '';
    this.bankStatusFilter = '';
    this.load();
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

  private matches(supplier: SupplierDirectoryRow): boolean {
    if (this.companyFilter && !supplier.companies.some(scope => scope.companyName === this.companyFilter)) {
      return false;
    }
    if (this.orgUnitFilter && !supplier.companies.some(scope => scope.orgUnits.includes(this.orgUnitFilter))) {
      return false;
    }
    if (this.categoryFilter && !supplier.categories.includes(this.categoryFilter)) {
      return false;
    }
    if (this.bankStatusFilter === 'pending' && !supplier.bankAccountsPendingVerification) {
      return false;
    }
    if (this.bankStatusFilter === 'verified' && supplier.bankAccountsPendingVerification) {
      return false;
    }
    return true;
  }

  private sortValue(supplier: SupplierDirectoryRow, field: DirectorySortField): SortValue {
    switch (field) {
      case 'legalName':
        return supplier.legalName;
      case 'taxId':
        return supplier.taxId;
      case 'riskScore':
        return supplier.riskScore;
      case 'companies':
        return this.companyNames(supplier);
      case 'orgUnits':
        return this.orgUnitNames(supplier);
      case 'contractCount':
        return supplier.contractCount;
      case 'consumedAmount':
        return supplier.consumedAmount;
      case 'invoiceCount':
        return supplier.invoiceCount;
      case 'bankAccountsPendingVerification':
        return supplier.bankAccountsPendingVerification;
    }
  }
}
