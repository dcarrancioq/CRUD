import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Invoice, InvoiceComparison, InvoiceComparisonField } from '../../../../core/models/invoice.model';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService } from '../../../../core/services/invoice.service';

@Component({
  selector: 'app-invoice-compare',
  templateUrl: './invoice-compare.component.html',
  styleUrls: ['./invoice-compare.component.css']
})
export class InvoiceCompareComponent implements OnInit {
  invoices: Invoice[] = [];
  leftId = '';
  rightId = '';
  comparison?: InvoiceComparison;
  onlyDifferences = false;
  devinRequest?: DevinSessionRequest;

  constructor(
    private invoiceService: InvoiceService,
    private devinApi: DevinApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.invoiceService.invoices$.subscribe(invoices => {
      this.invoices = invoices;
      if (!this.leftId && invoices.length) {
        this.leftId = invoices[0].id;
        this.rightId = invoices.length > 1 ? invoices[1].id : invoices[0].id;
      }
      this.compare();
    });

    const params = this.route.snapshot.queryParams;
    if (params['left'] && params['right']) {
      this.leftId = params['left'];
      this.rightId = params['right'];
      this.compare();
    }
  }

  compare(): void {
    this.devinRequest = undefined;
    if (!this.leftId || !this.rightId || this.leftId === this.rightId) {
      this.comparison = undefined;
      return;
    }
    this.comparison = this.invoiceService.compare(this.leftId, this.rightId);
  }

  get visibleFields(): InvoiceComparisonField[] {
    const fields = this.comparison?.fields ?? [];
    return this.onlyDifferences ? fields.filter(field => !field.equal) : fields;
  }

  get verdictLabel(): string {
    switch (this.comparison?.duplicateVerdict) {
      case 'likely_duplicate':
        return 'Duplicado muy probable: bloquear pago';
      case 'needs_review':
        return 'Revision manual necesaria';
      default:
        return 'Facturas distintas';
    }
  }

  get fraudSignals(): InvoiceComparisonField[] {
    return (this.comparison?.fields ?? []).filter(field => field.relevance === 'fraud_signal' && !field.equal);
  }

  swap(): void {
    const previousLeft = this.leftId;
    this.leftId = this.rightId;
    this.rightId = previousLeft;
    this.compare();
  }

  prepareDevinInvestigation(): void {
    if (!this.comparison) {
      return;
    }
    const { left, right, duplicateScore, matchedFields } = this.comparison;
    this.devinRequest = this.devinApi.buildDuplicateInvestigationRequest(left, {
      invoiceId: left.id,
      candidateInvoiceId: right.id,
      candidateInvoiceNumber: right.invoiceNumber,
      score: duplicateScore,
      matchedFields,
      reason: `Comparativa manual desde la pantalla de conciliacion (${matchedFields.join(', ')})`
    });
  }

  get devinRequestJson(): string {
    return this.devinRequest ? JSON.stringify(this.devinRequest, null, 2) : '';
  }

  invoiceLabel(invoice: Invoice): string {
    return `${invoice.invoiceNumber} - ${invoice.supplierName} (${invoice.totalAmount} ${invoice.currency})`;
  }
}
