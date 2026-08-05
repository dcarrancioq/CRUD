import { Component, OnInit } from '@angular/core';
import { ConsolidationOpportunity, Invoice, InvoiceException, Supplier } from '../../../../core/models/invoice.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService, InvoiceSummary } from '../../../../core/services/invoice.service';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.css']
})
export class InvoiceListComponent implements OnInit {
  invoices: Invoice[] = [];
  opportunities: ConsolidationOpportunity[] = [];
  supplierOptions: SearchableOption[] = [];
  supplierFilter = '';
  onlyExceptions = false;
  summary?: InvoiceSummary;
  devinRequest?: DevinSessionRequest;

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
    this.reload();
  }

  onSupplierFilterChange(): void {
    this.reload();
  }

  get visibleInvoices(): Invoice[] {
    return this.onlyExceptions ? this.invoices.filter(invoice => this.openExceptions(invoice).length > 0) : this.invoices;
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
    this.invoiceService.refresh({ supplierId: this.supplierFilter || undefined }).subscribe();
    this.invoiceService.getSummary().subscribe(summary => (this.summary = summary));
    this.invoiceService
      .getConsolidationOpportunities()
      .subscribe(opportunities => (this.opportunities = opportunities));
  }
}
