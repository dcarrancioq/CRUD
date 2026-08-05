import { Component, OnInit } from '@angular/core';
import { ConsolidationOpportunity, Invoice, InvoiceException } from '../../../../core/models/invoice.model';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService } from '../../../../core/services/invoice.service';

@Component({
  selector: 'app-invoice-list',
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.css']
})
export class InvoiceListComponent implements OnInit {
  invoices: Invoice[] = [];
  opportunities: ConsolidationOpportunity[] = [];
  onlyExceptions = false;
  devinRequest?: DevinSessionRequest;

  constructor(private invoiceService: InvoiceService, private devinApi: DevinApiService) {}

  ngOnInit(): void {
    this.invoiceService.invoices$.subscribe(invoices => (this.invoices = invoices));
    this.reload();
  }

  get visibleInvoices(): Invoice[] {
    return this.onlyExceptions ? this.invoices.filter(invoice => this.openExceptions(invoice).length > 0) : this.invoices;
  }

  get totalSpend(): number {
    return this.invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  }

  get blockedCount(): number {
    return this.invoices.filter(invoice => invoice.status === 'blocked').length;
  }

  get exceptionCount(): number {
    return this.invoiceService.getOpenExceptions().length;
  }

  get autoApprovedPercent(): number {
    if (!this.invoices.length) {
      return 0;
    }
    const auto = this.invoices.filter(invoice => invoice.exceptions.length === 0).length;
    return Math.round((auto / this.invoices.length) * 100);
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

  private reload(): void {
    this.invoiceService.refresh().subscribe();
    this.invoiceService
      .getConsolidationOpportunities()
      .subscribe(opportunities => (this.opportunities = opportunities));
  }
}
