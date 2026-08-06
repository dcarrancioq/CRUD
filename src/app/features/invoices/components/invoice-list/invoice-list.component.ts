import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { ConsolidationOpportunity, Invoice, InvoiceException, Supplier } from '../../../../core/models/invoice.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService, InvoiceSortField, InvoiceSummary } from '../../../../core/services/invoice.service';
import { SortDirection } from '../../../../shared/utils/table-sort';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.css']
})
export class InvoiceListComponent implements OnInit, OnDestroy {
  invoices: Invoice[] = [];
  opportunities: ConsolidationOpportunity[] = [];
  supplierOptions: SearchableOption[] = [];
  supplierFilter = '';
  statusFilter = '';
  riskBandFilter = '';
  searchTerm = '';
  onlyExceptions = false;
  sortField: InvoiceSortField = 'issueDate';
  sortDirection: SortDirection = 'desc';
  summary?: InvoiceSummary;
  devinRequest?: DevinSessionRequest;

  readonly statusOptions: SearchableOption[] = [
    { value: 'registered', label: 'Registrada' },
    { value: 'validated', label: 'Validada' },
    { value: 'blocked', label: 'Bloqueada' },
    { value: 'approved', label: 'Aprobada' },
    { value: 'paid', label: 'Pagada' },
    { value: 'rejected', label: 'Rechazada' }
  ];

  readonly riskBandOptions: SearchableOption[] = [
    { value: 'low', label: 'Bajo' },
    { value: 'medium', label: 'Medio' },
    { value: 'high', label: 'Alto' },
    { value: 'critical', label: 'Critico' }
  ];

  private readonly searchTrigger = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private invoiceService: InvoiceService,
    private masterData: ProcurementMasterDataService,
    private devinApi: DevinApiService
  ) {}

  ngOnInit(): void {
    this.invoiceService.invoices$.subscribe(invoices => (this.invoices = invoices));
    this.masterData.getSuppliers().subscribe(suppliers => {
      this.supplierOptions = suppliers.map(supplier => this.toSupplierOption(supplier));
    });
    this.searchTrigger
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.reload());
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    this.reload();
  }

  onSearchChange(): void {
    this.searchTrigger.next();
  }

  /** El orden se resuelve en servidor: la ventana cargada es solo una parte del total. */
  sortBy(field: string): void {
    const sortField = field as InvoiceSortField;
    if (this.sortField === sortField) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = sortField;
      this.sortDirection = 'asc';
    }
    this.reload();
  }

  clearFilters(): void {
    this.supplierFilter = '';
    this.statusFilter = '';
    this.riskBandFilter = '';
    this.searchTerm = '';
    this.onlyExceptions = false;
    this.reload();
  }

  get visibleInvoices(): Invoice[] {
    return this.invoices;
  }

  /** Los indicadores vienen agregados del backend: la tabla solo muestra una ventana. */
  get invoiceCount(): number {
    return this.summary?.invoiceCount ?? this.invoices.length;
  }

  get totalSpend(): number {
    return this.summary?.totalSpend ?? 0;
  }

  get blockedCount(): number {
    return this.summary?.blockedCount ?? 0;
  }

  get exceptionCount(): number {
    return this.summary?.openExceptions ?? 0;
  }

  get autoApprovedPercent(): number {
    return this.summary?.autoApprovedPercent ?? 0;
  }

  openExceptions(invoice: Invoice): InvoiceException[] {
    return invoice.exceptions.filter(exception => exception.status === 'open' || exception.status === 'in_review');
  }

  markFalsePositive(invoice: Invoice, exception: InvoiceException): void {
    this.invoiceService
      .resolveException(invoice.id, exception.id, 'false_positive', 'Descartada por el analista de compras')
      .subscribe(() => this.reload());
  }

  resolve(invoice: Invoice, exception: InvoiceException): void {
    this.invoiceService
      .resolveException(invoice.id, exception.id, 'resolved', 'Excepcion verificada y aceptada')
      .subscribe(() => this.reload());
  }

  requestConsolidationAnalysis(): void {
    this.devinRequest = this.devinApi.buildConsolidationAnalysisRequest(this.opportunities);
  }

  get devinRequestJson(): string {
    return this.devinRequest ? JSON.stringify(this.devinRequest, null, 2) : '';
  }

  private toSupplierOption(supplier: Supplier): SearchableOption {
    return {
      value: supplier.id,
      label: supplier.legalName,
      hint: `${supplier.taxId} | ${supplier.defaultCategoryCode ?? 'sin categoria'}`
    };
  }

  private reload(): void {
    this.invoiceService
      .refresh({
        supplierId: this.supplierFilter || undefined,
        status: this.statusFilter || undefined,
        riskBand: this.riskBandFilter || undefined,
        search: this.searchTerm.trim() || undefined,
        onlyExceptions: this.onlyExceptions,
        sort: this.sortField,
        direction: this.sortDirection
      })
      .subscribe();
    this.invoiceService.getSummary().subscribe(summary => (this.summary = summary));
    this.invoiceService
      .getConsolidationOpportunities()
      .subscribe(opportunities => (this.opportunities = opportunities));
  }
}
