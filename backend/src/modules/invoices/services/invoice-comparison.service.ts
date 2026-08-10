import { Injectable } from '@nestjs/common';
import { Invoice } from '../entities/invoice.entity';
import { InvoiceComparisonField } from '../invoice.types';
import { formatDate, maskIban, normalizeIban } from '../invoice.utils';
import { InvoiceAnomalyService } from './invoice-anomaly.service';

export interface InvoiceComparison {
  left: Invoice;
  right: Invoice;
  fields: InvoiceComparisonField[];
  duplicateScore: number;
  duplicateVerdict: 'likely_duplicate' | 'needs_review' | 'different';
  matchedFields: string[];
  differingFields: string[];
}

@Injectable()
export class InvoiceComparisonService {
  constructor(private readonly anomalies: InvoiceAnomalyService) {}

  compare(left: Invoice, right: Invoice): InvoiceComparison {
    const fields = this.buildFields(left, right);
    const { score } = this.anomalies.scoreDuplicate(left, right);
    return {
      left,
      right,
      fields,
      duplicateScore: score,
      duplicateVerdict: score >= 80 ? 'likely_duplicate' : score >= 50 ? 'needs_review' : 'different',
      matchedFields: fields.filter((field) => field.equal).map((field) => field.label),
      differingFields: fields.filter((field) => !field.equal).map((field) => field.label),
    };
  }

  private buildFields(left: Invoice, right: Invoice): InvoiceComparisonField[] {
    return [
      this.text('invoiceNumber', 'Numero de factura', left.invoiceNumber, right.invoiceNumber, 35, 'duplicate_signal'),
      this.text('supplier', 'Proveedor', left.supplierName, right.supplierName, 20, 'duplicate_signal'),
      this.text('supplierTaxId', 'NIF proveedor', left.supplierTaxId, right.supplierTaxId, 20, 'duplicate_signal'),
      this.text('issueDate', 'Fecha de emision', formatDate(left.issueDate), formatDate(right.issueDate), 10, 'duplicate_signal'),
      this.text('dueDate', 'Fecha de vencimiento', formatDate(left.dueDate), formatDate(right.dueDate), 5, 'informative'),
      // Dos facturas sin pedido no son evidencia de duplicado: solo informan.
      this.text(
        'purchaseOrder',
        'Pedido de compra',
        left.purchaseOrderNumber ?? '',
        right.purchaseOrderNumber ?? '',
        5,
        left.purchaseOrderNumber && right.purchaseOrderNumber ? 'duplicate_signal' : 'informative',
      ),
      {
        key: 'bankAccount',
        label: 'IBAN de cobro',
        leftValue: maskIban(left.bankAccountIban),
        rightValue: maskIban(right.bankAccountIban),
        equal: normalizeIban(left.bankAccountIban) === normalizeIban(right.bankAccountIban),
        weight: 5,
        relevance: 'fraud_signal',
      },
      this.text('bankHolder', 'Titular de la cuenta', left.bankAccountHolder ?? '', right.bankAccountHolder ?? '', 5, 'fraud_signal'),
      this.text('currency', 'Divisa', left.currency, right.currency, 5, 'fraud_signal'),
      this.numeric('subtotal', 'Base imponible', left.subtotal, right.subtotal, 10, 'duplicate_signal'),
      this.numeric('taxAmount', 'Impuestos', left.taxAmount, right.taxAmount, 5, 'informative'),
      this.numeric('totalAmount', 'Total factura', left.totalAmount, right.totalAmount, 25, 'duplicate_signal'),
      this.numeric('lineCount', 'Numero de lineas', left.lines.length, right.lines.length, 5, 'informative'),
      this.text(
        'category',
        'Categoria de gasto',
        `${left.categoryName} (${left.classificationConfidence}%)`,
        `${right.categoryName} (${right.classificationConfidence}%)`,
        5,
        'informative',
      ),
      this.text('costCenter', 'Centro de coste', left.costCenter, right.costCenter, 5, 'informative'),
      this.numeric('riskScore', 'Score de riesgo', left.riskScore, right.riskScore, 5, 'fraud_signal'),
      this.numeric('openExceptions', 'Excepciones abiertas', this.countOpen(left), this.countOpen(right), 5, 'fraud_signal'),
      this.text('status', 'Estado', left.status, right.status, 5, 'informative'),
    ];
  }

  private countOpen(invoice: Invoice): number {
    return (invoice.exceptions ?? []).filter(
      (exception) => exception.status === 'open' || exception.status === 'in_review',
    ).length;
  }

  private numeric(
    key: string,
    label: string,
    leftValue: number,
    rightValue: number,
    weight: number,
    relevance: InvoiceComparisonField['relevance'],
  ): InvoiceComparisonField {
    const delta = Math.round((rightValue - leftValue) * 100) / 100;
    return {
      key,
      label,
      leftValue: leftValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      rightValue: rightValue.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      equal: Math.abs(delta) < 0.01,
      deltaAbsolute: delta,
      deltaPercent: leftValue ? Math.round((delta / leftValue) * 10000) / 100 : undefined,
      weight,
      relevance,
    };
  }

  private text(
    key: string,
    label: string,
    leftValue: string,
    rightValue: string,
    weight: number,
    relevance: InvoiceComparisonField['relevance'],
  ): InvoiceComparisonField {
    return {
      key,
      label,
      leftValue: leftValue || '-',
      rightValue: rightValue || '-',
      equal: (leftValue || '').trim().toLowerCase() === (rightValue || '').trim().toLowerCase(),
      weight,
      relevance,
    };
  }
}
