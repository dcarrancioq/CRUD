import { Injectable } from '@angular/core';
import {
  DuplicateCandidate,
  ExceptionSeverity,
  Invoice,
  InvoiceException,
  RiskAssessment,
  RiskBand,
  RiskSignal,
  RuleCode,
  ThreeWayMatchResult,
  ToleranceRule
} from '../models/invoice.model';
import { ProcurementMasterDataService } from './procurement-master-data.service';

export interface AnomalyEvaluation {
  exceptions: InvoiceException[];
  duplicateCandidates: DuplicateCandidate[];
  matchResult?: ThreeWayMatchResult;
  riskAssessment: RiskAssessment;
}

export interface DuplicateScore {
  score: number;
  matchedFields: string[];
  reason: string;
}

const SEVERITY_WEIGHT: Record<ExceptionSeverity, number> = {
  low: 5,
  medium: 15,
  high: 30,
  critical: 45
};

@Injectable({
  providedIn: 'root'
})
export class InvoiceAnomalyService {
  constructor(private masterData: ProcurementMasterDataService) {}

  evaluate(invoice: Invoice, existingInvoices: Invoice[]): AnomalyEvaluation {
    const others = existingInvoices.filter(candidate => candidate.id !== invoice.id);
    const exceptions: InvoiceException[] = [];

    const duplicateCandidates = this.findDuplicateCandidates(invoice, others);
    exceptions.push(...this.duplicateExceptions(invoice, duplicateCandidates));
    exceptions.push(...this.bankAccountExceptions(invoice));

    const matchResult = this.matchAgainstPurchaseOrder(invoice);
    exceptions.push(...this.purchaseOrderExceptions(invoice, matchResult));
    exceptions.push(...this.contractPriceExceptions(invoice));
    exceptions.push(...this.arithmeticExceptions(invoice));
    exceptions.push(...this.behaviourExceptions(invoice, others));

    const filtered = exceptions.filter(exception => this.rule(exception.ruleCode)?.enabled !== false);
    const riskAssessment = this.assessRisk(invoice, filtered);

    return { exceptions: filtered, duplicateCandidates, matchResult, riskAssessment };
  }

  scoreDuplicate(left: Invoice, right: Invoice): DuplicateScore {
    const matchedFields: string[] = [];
    let score = 0;

    if (left.supplierTaxId === right.supplierTaxId) {
      score += 20;
      matchedFields.push('supplierTaxId');
    }
    if (this.normalizeNumber(left.invoiceNumber) === this.normalizeNumber(right.invoiceNumber)) {
      score += 35;
      matchedFields.push('invoiceNumber');
    }
    if (this.round(left.totalAmount) === this.round(right.totalAmount)) {
      score += 25;
      matchedFields.push('totalAmount');
    } else if (Math.abs(left.totalAmount - right.totalAmount) <= Math.max(left.totalAmount, right.totalAmount) * 0.01) {
      score += 12;
      matchedFields.push('totalAmount~1%');
    }
    const dayGap = this.daysBetween(left.issueDate, right.issueDate);
    if (dayGap === 0) {
      score += 10;
      matchedFields.push('issueDate');
    } else if (dayGap <= 7) {
      score += 5;
      matchedFields.push('issueDate±7d');
    }
    if (left.purchaseOrderNumber && left.purchaseOrderNumber === right.purchaseOrderNumber) {
      score += 5;
      matchedFields.push('purchaseOrderNumber');
    }
    if (left.bankAccountIban === right.bankAccountIban) {
      score += 5;
      matchedFields.push('bankAccountIban');
    }

    score = Math.min(100, score);
    const reason = matchedFields.length
      ? `Coincidencias en ${matchedFields.join(', ')}`
      : 'Sin coincidencias relevantes entre las facturas';
    return { score, matchedFields, reason };
  }

  private findDuplicateCandidates(invoice: Invoice, others: Invoice[]): DuplicateCandidate[] {
    return others
      .map(candidate => {
        const { score, matchedFields, reason } = this.scoreDuplicate(invoice, candidate);
        return {
          invoiceId: invoice.id,
          candidateInvoiceId: candidate.id,
          candidateInvoiceNumber: candidate.invoiceNumber,
          score,
          matchedFields,
          reason
        };
      })
      .filter(candidate => candidate.score >= 40)
      .sort((a, b) => b.score - a.score);
  }

  private duplicateExceptions(invoice: Invoice, candidates: DuplicateCandidate[]): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const exactRule = this.rule('DUPLICATE_EXACT');
    const fuzzyRule = this.rule('DUPLICATE_FUZZY');

    candidates.forEach(candidate => {
      const isExact =
        candidate.matchedFields.includes('invoiceNumber') &&
        candidate.matchedFields.includes('supplierTaxId') &&
        candidate.matchedFields.includes('totalAmount');

      if (isExact && exactRule?.enabled) {
        exceptions.push(
          this.buildException(invoice, exactRule, {
            title: 'Factura duplicada',
            message: `Mismo numero de factura, proveedor e importe que ${candidate.candidateInvoiceNumber}.`,
            observedValue: candidate.score,
            relatedInvoiceId: candidate.candidateInvoiceId
          })
        );
        return;
      }

      if (fuzzyRule?.enabled && candidate.score >= fuzzyRule.threshold) {
        exceptions.push(
          this.buildException(invoice, fuzzyRule, {
            title: 'Posible duplicado',
            message: `Similitud ${candidate.score}% con ${candidate.candidateInvoiceNumber}. ${candidate.reason}.`,
            observedValue: candidate.score,
            relatedInvoiceId: candidate.candidateInvoiceId
          })
        );
      }
    });

    return exceptions;
  }

  private bankAccountExceptions(invoice: Invoice): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const supplier = this.masterData.getSupplier(invoice.supplierId);
    if (!supplier) {
      return exceptions;
    }

    const account = supplier.bankAccounts.find(
      candidate => this.normalizeIban(candidate.iban) === this.normalizeIban(invoice.bankAccountIban)
    );
    const unknownRule = this.rule('BANK_ACCOUNT_UNKNOWN');
    const changeRule = this.rule('BANK_ACCOUNT_RECENT_CHANGE');

    if (!account && unknownRule?.enabled) {
      exceptions.push(
        this.buildException(invoice, unknownRule, {
          title: 'Cuenta bancaria no registrada',
          message: `El IBAN ${this.maskIban(
            invoice.bankAccountIban
          )} no coincide con ninguna cuenta del maestro del proveedor. Bloquear pago y verificar por canal independiente.`,
          observedValue: 1
        })
      );
      return exceptions;
    }

    if (account && account.status !== 'verified' && unknownRule?.enabled) {
      exceptions.push(
        this.buildException(invoice, unknownRule, {
          title: 'Cuenta bancaria sin verificar',
          message: `La cuenta ${this.maskIban(account.iban)} esta en estado ${account.status}. Requiere verificacion antes de liberar el pago.`,
          observedValue: 1
        })
      );
    }

    if (account && changeRule?.enabled) {
      const daysSinceRegistered = this.daysBetween(account.registeredAt, invoice.receivedDate);
      const primaryAccount = supplier.bankAccounts.find(candidate => candidate.isPrimary);
      const isDifferentFromPrimary = primaryAccount && primaryAccount.id !== account.id;
      if (daysSinceRegistered <= changeRule.threshold || isDifferentFromPrimary) {
        exceptions.push(
          this.buildException(invoice, changeRule, {
            title: 'Cambio reciente de cuenta bancaria',
            message: `La cuenta de cobro se registro hace ${daysSinceRegistered} dias${
              isDifferentFromPrimary ? ' y no es la cuenta principal del proveedor' : ''
            }. Patron habitual de fraude por suplantacion de proveedor.`,
            observedValue: daysSinceRegistered
          })
        );
      }
    }

    if (
      account &&
      invoice.bankAccountHolder &&
      this.normalizeText(invoice.bankAccountHolder) !== this.normalizeText(account.holderName)
    ) {
      const rule = this.rule('BANK_ACCOUNT_UNKNOWN');
      if (rule?.enabled) {
        exceptions.push(
          this.buildException(invoice, rule, {
            title: 'Titular de cuenta discrepante',
            message: `El titular declarado (${invoice.bankAccountHolder}) no coincide con el titular registrado (${account.holderName}).`,
            observedValue: 1
          })
        );
      }
    }

    return exceptions;
  }

  private matchAgainstPurchaseOrder(invoice: Invoice): ThreeWayMatchResult | undefined {
    if (!invoice.purchaseOrderNumber) {
      return undefined;
    }
    const order = this.masterData.getPurchaseOrderByNumber(invoice.purchaseOrderNumber);
    if (!order) {
      return {
        purchaseOrderNumber: invoice.purchaseOrderNumber,
        matched: false,
        amountVariance: invoice.subtotal,
        amountVariancePercent: 100,
        quantityVariance: 0,
        priceVariancePercent: 0,
        unmatchedLineNumbers: invoice.lines.map(line => line.lineNumber)
      };
    }

    let quantityVariance = 0;
    let maxPriceVariance = 0;
    const unmatchedLineNumbers: number[] = [];

    invoice.lines.forEach(line => {
      const orderLine =
        order.lines.find(candidate => candidate.itemCode && candidate.itemCode === line.itemCode) ??
        order.lines.find(candidate => this.normalizeText(candidate.description) === this.normalizeText(line.description));
      if (!orderLine) {
        unmatchedLineNumbers.push(line.lineNumber);
        return;
      }
      const pendingQuantity = orderLine.quantity - orderLine.invoicedQuantity;
      if (line.quantity > pendingQuantity) {
        quantityVariance += line.quantity - pendingQuantity;
      }
      if (orderLine.unitPrice > 0) {
        const priceVariance = ((line.unitPrice - orderLine.unitPrice) / orderLine.unitPrice) * 100;
        maxPriceVariance = Math.abs(priceVariance) > Math.abs(maxPriceVariance) ? priceVariance : maxPriceVariance;
      }
    });

    const amountVariance = this.round(invoice.subtotal - order.approvedAmount);
    return {
      purchaseOrderNumber: order.number,
      matched: unmatchedLineNumbers.length === 0 && quantityVariance === 0 && Math.abs(maxPriceVariance) < 0.01,
      amountVariance,
      amountVariancePercent: order.approvedAmount ? this.round((amountVariance / order.approvedAmount) * 100) : 0,
      quantityVariance: this.round(quantityVariance),
      priceVariancePercent: this.round(maxPriceVariance),
      unmatchedLineNumbers
    };
  }

  private purchaseOrderExceptions(invoice: Invoice, matchResult?: ThreeWayMatchResult): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const missingRule = this.rule('PO_MISSING');
    const varianceRule = this.rule('PO_AMOUNT_VARIANCE');

    if (!invoice.purchaseOrderNumber) {
      if (missingRule?.enabled && invoice.totalAmount > missingRule.threshold) {
        exceptions.push(
          this.buildException(invoice, missingRule, {
            title: 'Gasto sin pedido de compra',
            message: `Factura de ${this.formatAmount(invoice.totalAmount, invoice.currency)} sin PO asociada (maverick spend).`,
            observedValue: invoice.totalAmount
          })
        );
      }
      return exceptions;
    }

    if (!matchResult) {
      return exceptions;
    }

    if (varianceRule?.enabled && matchResult.amountVariance > 0 && Math.abs(matchResult.amountVariancePercent) > varianceRule.threshold) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Desviacion sobre pedido de compra',
          message: `La base imponible supera el importe aprobado de ${matchResult.purchaseOrderNumber} en ${this.formatAmount(
            matchResult.amountVariance,
            invoice.currency
          )} (${matchResult.amountVariancePercent}%).`,
          observedValue: Math.abs(matchResult.amountVariancePercent)
        })
      );
    }

    if (varianceRule?.enabled && matchResult.quantityVariance > 0) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Cantidad facturada superior a la pendiente',
          message: `Se facturan ${matchResult.quantityVariance} unidades por encima de lo pendiente de facturar en ${matchResult.purchaseOrderNumber}.`,
          observedValue: matchResult.quantityVariance
        })
      );
    }

    if (varianceRule?.enabled && matchResult.unmatchedLineNumbers.length) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Lineas sin correspondencia en el pedido',
          message: `Lineas ${matchResult.unmatchedLineNumbers.join(', ')} no encontradas en ${matchResult.purchaseOrderNumber}.`,
          observedValue: matchResult.unmatchedLineNumbers.length
        })
      );
    }

    return exceptions;
  }

  private contractPriceExceptions(invoice: Invoice): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const rule = this.rule('PRICE_DEVIATION_CONTRACT');
    if (!rule?.enabled) {
      return exceptions;
    }
    const contracts = this.masterData.getContractsBySupplier(invoice.supplierId);
    if (!contracts.length) {
      return exceptions;
    }

    invoice.lines.forEach(line => {
      const contractPrice = contracts
        .flatMap(contract => contract.priceList)
        .find(
          price =>
            (line.itemCode && price.itemCode === line.itemCode) ||
            this.normalizeText(price.description) === this.normalizeText(line.description)
        );
      if (!contractPrice || contractPrice.unitPrice <= 0) {
        return;
      }
      const deviation = ((line.unitPrice - contractPrice.unitPrice) / contractPrice.unitPrice) * 100;
      if (deviation > rule.threshold) {
        exceptions.push(
          this.buildException(invoice, rule, {
            title: 'Precio por encima de contrato',
            message: `Linea ${line.lineNumber} (${line.description}): precio facturado ${line.unitPrice} frente a ${contractPrice.unitPrice} de tarifa (+${this.round(
              deviation
            )}%).`,
            observedValue: this.round(deviation)
          })
        );
      }
    });

    const paymentTermsRule = this.rule('PAYMENT_TERMS_MISMATCH');
    const contract = contracts[0];
    if (paymentTermsRule?.enabled && contract) {
      const diff = Math.abs(invoice.paymentTermsDays - contract.paymentTermsDays);
      if (diff > paymentTermsRule.threshold) {
        exceptions.push(
          this.buildException(invoice, paymentTermsRule, {
            title: 'Condiciones de pago distintas al contrato',
            message: `La factura indica ${invoice.paymentTermsDays} dias frente a ${contract.paymentTermsDays} dias del contrato ${contract.reference}.`,
            observedValue: diff
          })
        );
      }
    }

    const currencyRule = this.rule('CURRENCY_MISMATCH');
    if (currencyRule?.enabled && contract && contract.currency !== invoice.currency) {
      exceptions.push(
        this.buildException(invoice, currencyRule, {
          title: 'Divisa distinta a la contratada',
          message: `Factura en ${invoice.currency} frente a ${contract.currency} del contrato ${contract.reference}.`,
          observedValue: 1
        })
      );
    }

    return exceptions;
  }

  private arithmeticExceptions(invoice: Invoice): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const totalsRule = this.rule('TOTALS_MISMATCH');
    const taxRule = this.rule('TAX_MISMATCH');

    const linesSum = this.round(invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0));
    if (totalsRule?.enabled && Math.abs(linesSum - invoice.subtotal) > totalsRule.threshold) {
      exceptions.push(
        this.buildException(invoice, totalsRule, {
          title: 'Descuadre entre lineas y cabecera',
          message: `La suma de lineas (${linesSum}) no coincide con la base imponible declarada (${invoice.subtotal}).`,
          observedValue: Math.abs(this.round(linesSum - invoice.subtotal))
        })
      );
    }

    const expectedTax = this.round((invoice.subtotal * invoice.taxRate) / 100);
    if (taxRule?.enabled && Math.abs(expectedTax - invoice.taxAmount) > taxRule.threshold) {
      exceptions.push(
        this.buildException(invoice, taxRule, {
          title: 'Impuesto incoherente',
          message: `Impuesto declarado ${invoice.taxAmount} frente a ${expectedTax} esperado al ${invoice.taxRate}%.`,
          observedValue: Math.abs(this.round(expectedTax - invoice.taxAmount))
        })
      );
    }

    const expectedTotal = this.round(invoice.subtotal + invoice.taxAmount);
    if (totalsRule?.enabled && Math.abs(expectedTotal - invoice.totalAmount) > totalsRule.threshold) {
      exceptions.push(
        this.buildException(invoice, totalsRule, {
          title: 'Total incoherente',
          message: `Total declarado ${invoice.totalAmount} frente a ${expectedTotal} (base + impuesto).`,
          observedValue: Math.abs(this.round(expectedTotal - invoice.totalAmount))
        })
      );
    }

    return exceptions;
  }

  private behaviourExceptions(invoice: Invoice, others: Invoice[]): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const profile = this.masterData.getToleranceProfile();

    const splittingRule = this.rule('THRESHOLD_SPLITTING');
    if (splittingRule?.enabled && profile.approvalThreshold > 0) {
      const gapPercent = ((profile.approvalThreshold - invoice.totalAmount) / profile.approvalThreshold) * 100;
      if (gapPercent >= 0 && gapPercent <= splittingRule.threshold) {
        exceptions.push(
          this.buildException(invoice, splittingRule, {
            title: 'Importe justo por debajo del umbral de aprobacion',
            message: `El total queda un ${this.round(gapPercent)}% por debajo del umbral de ${this.formatAmount(
              profile.approvalThreshold,
              profile.currency
            )}. Posible fraccionamiento de gasto.`,
            observedValue: this.round(gapPercent)
          })
        );
      }
    }

    const roundRule = this.rule('ROUND_AMOUNT');
    if (roundRule?.enabled && invoice.totalAmount >= roundRule.threshold && invoice.totalAmount % 1000 === 0) {
      exceptions.push(
        this.buildException(invoice, roundRule, {
          title: 'Importe inusualmente redondo',
          message: `Total de ${this.formatAmount(invoice.totalAmount, invoice.currency)} sin decimales ni detalle proporcional a las lineas.`,
          observedValue: invoice.totalAmount
        })
      );
    }

    const supplierHistory = others.filter(candidate => candidate.supplierId === invoice.supplierId);
    const outlierRule = this.rule('AMOUNT_OUTLIER_HISTORY');
    if (outlierRule?.enabled && supplierHistory.length >= 2) {
      const average = supplierHistory.reduce((sum, candidate) => sum + candidate.totalAmount, 0) / supplierHistory.length;
      if (average > 0) {
        const deviation = ((invoice.totalAmount - average) / average) * 100;
        if (deviation > outlierRule.threshold) {
          exceptions.push(
            this.buildException(invoice, outlierRule, {
              title: 'Importe atipico frente al historico',
              message: `El importe supera en ${this.round(deviation)}% la media historica del proveedor (${this.formatAmount(
                this.round(average),
                invoice.currency
              )}).`,
              observedValue: this.round(deviation)
            })
          );
        }
      }
    }

    const supplier = this.masterData.getSupplier(invoice.supplierId);
    const newSupplierRule = this.rule('NEW_SUPPLIER_HIGH_AMOUNT');
    if (newSupplierRule?.enabled && supplier) {
      const supplierAgeDays = this.daysBetween(supplier.onboardedAt, invoice.receivedDate);
      if (supplierAgeDays <= 90 && invoice.totalAmount > newSupplierRule.threshold) {
        exceptions.push(
          this.buildException(invoice, newSupplierRule, {
            title: 'Proveedor reciente con importe elevado',
            message: `Proveedor dado de alta hace ${supplierAgeDays} dias con factura de ${this.formatAmount(
              invoice.totalAmount,
              invoice.currency
            )}.`,
            observedValue: invoice.totalAmount
          })
        );
      }
    }

    const backdatedRule = this.rule('BACKDATED_INVOICE');
    if (backdatedRule?.enabled) {
      const lag = this.daysBetween(invoice.issueDate, invoice.receivedDate);
      if (lag > backdatedRule.threshold) {
        exceptions.push(
          this.buildException(invoice, backdatedRule, {
            title: 'Factura recibida con retraso excesivo',
            message: `Han pasado ${lag} dias entre la emision y la recepcion; revisar periodo contable y riesgo de reclamacion.`,
            observedValue: lag
          })
        );
      }
    }

    const confidenceRule = this.rule('LOW_CLASSIFICATION_CONFIDENCE');
    if (confidenceRule?.enabled && invoice.classification.confidence < confidenceRule.threshold) {
      exceptions.push(
        this.buildException(invoice, confidenceRule, {
          title: 'Clasificacion de gasto poco fiable',
          message: `Confianza ${invoice.classification.confidence}% al asignar ${invoice.classification.categoryName}. Requiere validacion manual de categoria.`,
          observedValue: invoice.classification.confidence
        })
      );
    }

    return exceptions;
  }

  private assessRisk(invoice: Invoice, exceptions: InvoiceException[]): RiskAssessment {
    const signals: RiskSignal[] = exceptions.map(exception => ({
      code: exception.ruleCode,
      weight: SEVERITY_WEIGHT[exception.severity],
      detail: exception.title
    }));

    const supplier = this.masterData.getSupplier(invoice.supplierId);
    if (supplier && supplier.riskScore >= 50) {
      signals.push({
        code: 'NEW_SUPPLIER_HIGH_AMOUNT',
        weight: 10,
        detail: `Proveedor con riesgo de maestro elevado (${supplier.riskScore}/100)`
      });
    }

    const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
    const band: RiskBand = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
    const blocking = exceptions.some(exception => exception.blocksPayment);

    return {
      invoiceId: invoice.id,
      score,
      band,
      signals,
      evaluatedAt: new Date(),
      releaseRecommendation: blocking ? 'block' : score >= 20 ? 'manual_review' : 'auto_release'
    };
  }

  private buildException(
    invoice: Invoice,
    rule: ToleranceRule,
    data: { title: string; message: string; observedValue: number; relatedInvoiceId?: string }
  ): InvoiceException {
    return {
      id: `exc-${Math.random().toString(36).slice(2, 10)}`,
      invoiceId: invoice.id,
      ruleCode: rule.ruleCode,
      title: data.title,
      message: data.message,
      severity: rule.severity,
      status: 'open',
      observedValue: data.observedValue,
      toleranceValue: rule.threshold,
      toleranceUnit: rule.unit,
      blocksPayment: rule.blocksPayment,
      detectedAt: new Date(),
      relatedInvoiceId: data.relatedInvoiceId
    };
  }

  private rule(code: RuleCode): ToleranceRule | undefined {
    return this.masterData.getToleranceProfile().rules.find(rule => rule.ruleCode === code);
  }

  private normalizeNumber(value: string): string {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private normalizeIban(value: string): string {
    return (value ?? '').toUpperCase().replace(/\s/g, '');
  }

  private normalizeText(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private maskIban(iban: string): string {
    const clean = this.normalizeIban(iban);
    return clean.length > 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : clean;
  }

  private daysBetween(a: Date | string, b: Date | string): number {
    const first = new Date(a).getTime();
    const second = new Date(b).getTime();
    return Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatAmount(value: number, currency: string): string {
    return `${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}
