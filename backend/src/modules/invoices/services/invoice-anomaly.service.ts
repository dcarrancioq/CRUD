import { Injectable } from '@nestjs/common';
import { Contract } from '../../master-data/entities/contract.entity';
import { PurchaseOrder } from '../../master-data/entities/purchase-order.entity';
import { Supplier } from '../../master-data/entities/supplier.entity';
import { ToleranceProfile } from '../../master-data/entities/tolerance-profile.entity';
import {
  ExceptionSeverity,
  RuleCode,
  ToleranceRule,
} from '../../master-data/entities/tolerance-rule.entity';
import { DuplicateCandidate } from '../entities/duplicate-candidate.entity';
import { InvoiceException } from '../entities/invoice-exception.entity';
import { Invoice } from '../entities/invoice.entity';
import { DuplicateScore, RiskBand, RiskSignal, ThreeWayMatchResult } from '../invoice.types';
import {
  daysBetween,
  formatAmount,
  generateId,
  maskIban,
  normalizeIban,
  normalizeInvoiceNumber,
  normalizeText,
  round,
} from '../invoice.utils';

export interface EvaluationContext {
  profile: ToleranceProfile;
  supplier?: Supplier | null;
  contracts: Contract[];
  purchaseOrder?: PurchaseOrder | null;
  history: Invoice[];
}

export interface AnomalyEvaluation {
  exceptions: InvoiceException[];
  duplicateCandidates: DuplicateCandidate[];
  matchResult: ThreeWayMatchResult | null;
  riskScore: number;
  riskBand: RiskBand;
  riskSignals: RiskSignal[];
  releaseRecommendation: 'auto_release' | 'manual_review' | 'block';
}

const SEVERITY_WEIGHT: Record<ExceptionSeverity, number> = {
  low: 5,
  medium: 15,
  high: 30,
  critical: 45,
};

const DUPLICATE_CANDIDATE_MIN_SCORE = 40;

@Injectable()
export class InvoiceAnomalyService {
  evaluate(invoice: Invoice, context: EvaluationContext): AnomalyEvaluation {
    const others = context.history.filter((candidate) => candidate.id !== invoice.id);
    const exceptions: InvoiceException[] = [];

    const duplicateCandidates = this.findDuplicateCandidates(invoice, others);
    exceptions.push(...this.duplicateExceptions(invoice, duplicateCandidates, context));
    exceptions.push(...this.bankAccountExceptions(invoice, context));

    const matchResult = this.matchAgainstPurchaseOrder(invoice, context);
    exceptions.push(...this.purchaseOrderExceptions(invoice, context, matchResult));
    exceptions.push(...this.contractExceptions(invoice, context));
    exceptions.push(...this.arithmeticExceptions(invoice, context));
    exceptions.push(...this.behaviourExceptions(invoice, others, context));

    return { ...this.assessRisk(invoice, exceptions, context), exceptions, duplicateCandidates, matchResult };
  }

  scoreDuplicate(left: Invoice, right: Invoice): DuplicateScore {
    const matchedFields: string[] = [];
    let score = 0;

    if (left.supplierTaxId === right.supplierTaxId) {
      score += 20;
      matchedFields.push('supplierTaxId');
    }
    if (normalizeInvoiceNumber(left.invoiceNumber) === normalizeInvoiceNumber(right.invoiceNumber)) {
      score += 35;
      matchedFields.push('invoiceNumber');
    }
    if (round(left.totalAmount) === round(right.totalAmount)) {
      score += 25;
      matchedFields.push('totalAmount');
    } else if (
      Math.abs(left.totalAmount - right.totalAmount) <=
      Math.max(left.totalAmount, right.totalAmount) * 0.01
    ) {
      score += 12;
      matchedFields.push('totalAmount~1%');
    }

    const dayGap = daysBetween(left.issueDate, right.issueDate);
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
    if (normalizeIban(left.bankAccountIban) === normalizeIban(right.bankAccountIban)) {
      score += 5;
      matchedFields.push('bankAccountIban');
    }

    score = Math.min(100, score);
    return {
      score,
      matchedFields,
      reason: matchedFields.length
        ? `Coincidencias en ${matchedFields.join(', ')}`
        : 'Sin coincidencias relevantes entre las facturas',
    };
  }

  private findDuplicateCandidates(invoice: Invoice, others: Invoice[]): DuplicateCandidate[] {
    return others
      .map((candidate) => {
        const { score, matchedFields, reason } = this.scoreDuplicate(invoice, candidate);
        return {
          id: generateId('dup'),
          invoiceId: invoice.id,
          candidateInvoiceId: candidate.id,
          candidateInvoiceNumber: candidate.invoiceNumber,
          score,
          matchedFields,
          reason,
        } as DuplicateCandidate;
      })
      .filter((candidate) => candidate.score >= DUPLICATE_CANDIDATE_MIN_SCORE)
      .sort((a, b) => b.score - a.score);
  }

  private duplicateExceptions(
    invoice: Invoice,
    candidates: DuplicateCandidate[],
    context: EvaluationContext,
  ): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const exactRule = this.rule(context, 'DUPLICATE_EXACT');
    const fuzzyRule = this.rule(context, 'DUPLICATE_FUZZY');

    candidates.forEach((candidate) => {
      const isExact =
        candidate.matchedFields.includes('invoiceNumber') &&
        candidate.matchedFields.includes('supplierTaxId') &&
        candidate.matchedFields.includes('totalAmount');

      if (isExact && exactRule) {
        exceptions.push(
          this.buildException(invoice, exactRule, {
            title: 'Factura duplicada',
            message: `Mismo numero de factura, proveedor e importe que ${candidate.candidateInvoiceNumber}.`,
            observedValue: candidate.score,
            relatedInvoiceId: candidate.candidateInvoiceId,
          }),
        );
        return;
      }

      if (fuzzyRule && candidate.score >= fuzzyRule.threshold) {
        exceptions.push(
          this.buildException(invoice, fuzzyRule, {
            title: 'Posible duplicado',
            message: `Similitud ${candidate.score}% con ${candidate.candidateInvoiceNumber}. ${candidate.reason}.`,
            observedValue: candidate.score,
            relatedInvoiceId: candidate.candidateInvoiceId,
          }),
        );
      }
    });

    return exceptions;
  }

  private bankAccountExceptions(invoice: Invoice, context: EvaluationContext): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const supplier = context.supplier;
    if (!supplier) {
      return exceptions;
    }

    const account = (supplier.bankAccounts ?? []).find(
      (candidate) => normalizeIban(candidate.iban) === normalizeIban(invoice.bankAccountIban),
    );
    const unknownRule = this.rule(context, 'BANK_ACCOUNT_UNKNOWN');
    const changeRule = this.rule(context, 'BANK_ACCOUNT_RECENT_CHANGE');

    if (!account) {
      if (unknownRule) {
        exceptions.push(
          this.buildException(invoice, unknownRule, {
            title: 'Cuenta bancaria no registrada',
            message: `El IBAN ${maskIban(
              invoice.bankAccountIban,
            )} no coincide con ninguna cuenta del maestro del proveedor. Bloquear pago y verificar por canal independiente.`,
            observedValue: 1,
          }),
        );
      }
      return exceptions;
    }

    if (account.status !== 'verified' && unknownRule) {
      exceptions.push(
        this.buildException(invoice, unknownRule, {
          title: 'Cuenta bancaria sin verificar',
          message: `La cuenta ${maskIban(account.iban)} esta en estado ${
            account.status
          }. Requiere verificacion antes de liberar el pago.`,
          observedValue: 1,
        }),
      );
    }

    if (changeRule) {
      const daysSinceRegistered = daysBetween(account.registeredAt, invoice.receivedDate);
      const primaryAccount = (supplier.bankAccounts ?? []).find((candidate) => candidate.isPrimary);
      const isDifferentFromPrimary = !!primaryAccount && primaryAccount.id !== account.id;
      if (daysSinceRegistered <= changeRule.threshold || isDifferentFromPrimary) {
        exceptions.push(
          this.buildException(invoice, changeRule, {
            title: 'Cambio reciente de cuenta bancaria',
            message: `La cuenta de cobro se registro hace ${daysSinceRegistered} dias${
              isDifferentFromPrimary ? ' y no es la cuenta principal del proveedor' : ''
            }. Patron habitual de fraude por suplantacion de proveedor.`,
            observedValue: daysSinceRegistered,
          }),
        );
      }
    }

    if (
      unknownRule &&
      invoice.bankAccountHolder &&
      normalizeText(invoice.bankAccountHolder) !== normalizeText(account.holderName)
    ) {
      exceptions.push(
        this.buildException(invoice, unknownRule, {
          title: 'Titular de cuenta discrepante',
          message: `El titular declarado (${invoice.bankAccountHolder}) no coincide con el titular registrado (${account.holderName}).`,
          observedValue: 1,
        }),
      );
    }

    return exceptions;
  }

  private matchAgainstPurchaseOrder(
    invoice: Invoice,
    context: EvaluationContext,
  ): ThreeWayMatchResult | null {
    if (!invoice.purchaseOrderNumber) {
      return null;
    }
    const order = context.purchaseOrder;
    if (!order) {
      return {
        purchaseOrderNumber: invoice.purchaseOrderNumber,
        matched: false,
        amountVariance: invoice.subtotal,
        amountVariancePercent: 100,
        quantityVariance: 0,
        priceVariancePercent: 0,
        unmatchedLineNumbers: invoice.lines.map((line) => line.lineNumber),
      };
    }

    let quantityVariance = 0;
    let maxPriceVariance = 0;
    const unmatchedLineNumbers: number[] = [];

    invoice.lines.forEach((line) => {
      const orderLine =
        (order.lines ?? []).find(
          (candidate) => candidate.itemCode && candidate.itemCode === line.itemCode,
        ) ??
        (order.lines ?? []).find(
          (candidate) => normalizeText(candidate.description) === normalizeText(line.description),
        );
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
        maxPriceVariance =
          Math.abs(priceVariance) > Math.abs(maxPriceVariance) ? priceVariance : maxPriceVariance;
      }
    });

    const amountVariance = round(invoice.subtotal - order.approvedAmount);
    return {
      purchaseOrderNumber: order.number,
      matched:
        unmatchedLineNumbers.length === 0 && quantityVariance === 0 && Math.abs(maxPriceVariance) < 0.01,
      amountVariance,
      amountVariancePercent: order.approvedAmount
        ? round((amountVariance / order.approvedAmount) * 100)
        : 0,
      quantityVariance: round(quantityVariance),
      priceVariancePercent: round(maxPriceVariance),
      unmatchedLineNumbers,
    };
  }

  private purchaseOrderExceptions(
    invoice: Invoice,
    context: EvaluationContext,
    matchResult: ThreeWayMatchResult | null,
  ): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const missingRule = this.rule(context, 'PO_MISSING');
    const varianceRule = this.rule(context, 'PO_AMOUNT_VARIANCE');

    if (!invoice.purchaseOrderNumber) {
      if (missingRule && invoice.totalAmount > missingRule.threshold) {
        exceptions.push(
          this.buildException(invoice, missingRule, {
            title: 'Gasto sin pedido de compra',
            message: `Factura de ${formatAmount(
              invoice.totalAmount,
              invoice.currency,
            )} sin PO asociada (maverick spend).`,
            observedValue: invoice.totalAmount,
          }),
        );
      }
      return exceptions;
    }

    if (!matchResult || !varianceRule) {
      return exceptions;
    }

    if (
      matchResult.amountVariance > 0 &&
      Math.abs(matchResult.amountVariancePercent) > varianceRule.threshold
    ) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Desviacion sobre pedido de compra',
          message: `La base imponible supera el importe aprobado de ${
            matchResult.purchaseOrderNumber
          } en ${formatAmount(matchResult.amountVariance, invoice.currency)} (${
            matchResult.amountVariancePercent
          }%).`,
          observedValue: Math.abs(matchResult.amountVariancePercent),
        }),
      );
    }

    if (matchResult.quantityVariance > 0) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Cantidad facturada superior a la pendiente',
          message: `Se facturan ${matchResult.quantityVariance} unidades por encima de lo pendiente de facturar en ${matchResult.purchaseOrderNumber}.`,
          observedValue: matchResult.quantityVariance,
        }),
      );
    }

    if (matchResult.unmatchedLineNumbers.length) {
      exceptions.push(
        this.buildException(invoice, varianceRule, {
          title: 'Lineas sin correspondencia en el pedido',
          message: `Lineas ${matchResult.unmatchedLineNumbers.join(', ')} no encontradas en ${
            matchResult.purchaseOrderNumber
          }.`,
          observedValue: matchResult.unmatchedLineNumbers.length,
        }),
      );
    }

    return exceptions;
  }

  private contractExceptions(invoice: Invoice, context: EvaluationContext): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const contracts = context.contracts;
    if (!contracts.length) {
      return exceptions;
    }

    const priceRule = this.rule(context, 'PRICE_DEVIATION_CONTRACT');
    if (priceRule) {
      invoice.lines.forEach((line) => {
        const contractPrice = contracts
          .flatMap((contract) => contract.priceList ?? [])
          .find(
            (price) =>
              (line.itemCode && price.itemCode === line.itemCode) ||
              normalizeText(price.description) === normalizeText(line.description),
          );
        if (!contractPrice || contractPrice.unitPrice <= 0) {
          return;
        }
        const deviation = ((line.unitPrice - contractPrice.unitPrice) / contractPrice.unitPrice) * 100;
        if (deviation > priceRule.threshold) {
          exceptions.push(
            this.buildException(invoice, priceRule, {
              title: 'Precio por encima de contrato',
              message: `Linea ${line.lineNumber} (${line.description}): precio facturado ${
                line.unitPrice
              } frente a ${contractPrice.unitPrice} de tarifa (+${round(deviation)}%).`,
              observedValue: round(deviation),
            }),
          );
        }
      });
    }

    const contract = contracts[0];
    const paymentTermsRule = this.rule(context, 'PAYMENT_TERMS_MISMATCH');
    if (paymentTermsRule && contract) {
      const diff = Math.abs(invoice.paymentTermsDays - contract.paymentTermsDays);
      if (diff > paymentTermsRule.threshold) {
        exceptions.push(
          this.buildException(invoice, paymentTermsRule, {
            title: 'Condiciones de pago distintas al contrato',
            message: `La factura indica ${invoice.paymentTermsDays} dias frente a ${contract.paymentTermsDays} dias del contrato ${contract.reference}.`,
            observedValue: diff,
          }),
        );
      }
    }

    const currencyRule = this.rule(context, 'CURRENCY_MISMATCH');
    if (currencyRule && contract && contract.currency !== invoice.currency) {
      exceptions.push(
        this.buildException(invoice, currencyRule, {
          title: 'Divisa distinta a la contratada',
          message: `Factura en ${invoice.currency} frente a ${contract.currency} del contrato ${contract.reference}.`,
          observedValue: 1,
        }),
      );
    }

    return exceptions;
  }

  private arithmeticExceptions(invoice: Invoice, context: EvaluationContext): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const totalsRule = this.rule(context, 'TOTALS_MISMATCH');
    const taxRule = this.rule(context, 'TAX_MISMATCH');

    const linesSum = round(invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0));
    if (totalsRule && Math.abs(linesSum - invoice.subtotal) > totalsRule.threshold) {
      exceptions.push(
        this.buildException(invoice, totalsRule, {
          title: 'Descuadre entre lineas y cabecera',
          message: `La suma de lineas (${linesSum}) no coincide con la base imponible declarada (${invoice.subtotal}).`,
          observedValue: Math.abs(round(linesSum - invoice.subtotal)),
        }),
      );
    }

    const expectedTax = round((invoice.subtotal * invoice.taxRate) / 100);
    if (taxRule && Math.abs(expectedTax - invoice.taxAmount) > taxRule.threshold) {
      exceptions.push(
        this.buildException(invoice, taxRule, {
          title: 'Impuesto incoherente',
          message: `Impuesto declarado ${invoice.taxAmount} frente a ${expectedTax} esperado al ${invoice.taxRate}%.`,
          observedValue: Math.abs(round(expectedTax - invoice.taxAmount)),
        }),
      );
    }

    const expectedTotal = round(invoice.subtotal + invoice.taxAmount);
    if (totalsRule && Math.abs(expectedTotal - invoice.totalAmount) > totalsRule.threshold) {
      exceptions.push(
        this.buildException(invoice, totalsRule, {
          title: 'Total incoherente',
          message: `Total declarado ${invoice.totalAmount} frente a ${expectedTotal} (base + impuesto).`,
          observedValue: Math.abs(round(expectedTotal - invoice.totalAmount)),
        }),
      );
    }

    return exceptions;
  }

  private behaviourExceptions(
    invoice: Invoice,
    others: Invoice[],
    context: EvaluationContext,
  ): InvoiceException[] {
    const exceptions: InvoiceException[] = [];
    const profile = context.profile;

    const splittingRule = this.rule(context, 'THRESHOLD_SPLITTING');
    if (splittingRule && profile.approvalThreshold > 0) {
      const gapPercent =
        ((profile.approvalThreshold - invoice.totalAmount) / profile.approvalThreshold) * 100;
      if (gapPercent >= 0 && gapPercent <= splittingRule.threshold) {
        exceptions.push(
          this.buildException(invoice, splittingRule, {
            title: 'Importe justo por debajo del umbral de aprobacion',
            message: `El total queda un ${round(gapPercent)}% por debajo del umbral de ${formatAmount(
              profile.approvalThreshold,
              profile.currency,
            )}. Posible fraccionamiento de gasto.`,
            observedValue: round(gapPercent),
          }),
        );
      }
    }

    const roundRule = this.rule(context, 'ROUND_AMOUNT');
    if (roundRule && invoice.totalAmount >= roundRule.threshold && invoice.totalAmount % 1000 === 0) {
      exceptions.push(
        this.buildException(invoice, roundRule, {
          title: 'Importe inusualmente redondo',
          message: `Total de ${formatAmount(
            invoice.totalAmount,
            invoice.currency,
          )} sin decimales ni detalle proporcional a las lineas.`,
          observedValue: invoice.totalAmount,
        }),
      );
    }

    const supplierHistory = others.filter((candidate) => candidate.supplierId === invoice.supplierId);
    const outlierRule = this.rule(context, 'AMOUNT_OUTLIER_HISTORY');
    if (outlierRule && supplierHistory.length >= 2) {
      const average =
        supplierHistory.reduce((sum, candidate) => sum + candidate.totalAmount, 0) /
        supplierHistory.length;
      if (average > 0) {
        const deviation = ((invoice.totalAmount - average) / average) * 100;
        if (deviation > outlierRule.threshold) {
          exceptions.push(
            this.buildException(invoice, outlierRule, {
              title: 'Importe atipico frente al historico',
              message: `El importe supera en ${round(
                deviation,
              )}% la media historica del proveedor (${formatAmount(round(average), invoice.currency)}).`,
              observedValue: round(deviation),
            }),
          );
        }
      }
    }

    const newSupplierRule = this.rule(context, 'NEW_SUPPLIER_HIGH_AMOUNT');
    if (newSupplierRule && context.supplier) {
      const supplierAgeDays = daysBetween(context.supplier.onboardedAt, invoice.receivedDate);
      if (supplierAgeDays <= 90 && invoice.totalAmount > newSupplierRule.threshold) {
        exceptions.push(
          this.buildException(invoice, newSupplierRule, {
            title: 'Proveedor reciente con importe elevado',
            message: `Proveedor dado de alta hace ${supplierAgeDays} dias con factura de ${formatAmount(
              invoice.totalAmount,
              invoice.currency,
            )}.`,
            observedValue: invoice.totalAmount,
          }),
        );
      }
    }

    const backdatedRule = this.rule(context, 'BACKDATED_INVOICE');
    if (backdatedRule) {
      const lag = daysBetween(invoice.issueDate, invoice.receivedDate);
      if (lag > backdatedRule.threshold) {
        exceptions.push(
          this.buildException(invoice, backdatedRule, {
            title: 'Factura recibida con retraso excesivo',
            message: `Han pasado ${lag} dias entre la emision y la recepcion; revisar periodo contable y riesgo de reclamacion.`,
            observedValue: lag,
          }),
        );
      }
    }

    const confidenceRule = this.rule(context, 'LOW_CLASSIFICATION_CONFIDENCE');
    if (confidenceRule && invoice.classificationConfidence < confidenceRule.threshold) {
      exceptions.push(
        this.buildException(invoice, confidenceRule, {
          title: 'Clasificacion de gasto poco fiable',
          message: `Confianza ${invoice.classificationConfidence}% al asignar ${invoice.categoryName}. Requiere validacion manual de categoria.`,
          observedValue: invoice.classificationConfidence,
        }),
      );
    }

    return exceptions;
  }

  private assessRisk(
    invoice: Invoice,
    exceptions: InvoiceException[],
    context: EvaluationContext,
  ): Pick<AnomalyEvaluation, 'riskScore' | 'riskBand' | 'riskSignals' | 'releaseRecommendation'> {
    const riskSignals: RiskSignal[] = exceptions.map((exception) => ({
      code: exception.ruleCode,
      weight: SEVERITY_WEIGHT[exception.severity],
      detail: exception.title,
    }));

    if (context.supplier && context.supplier.riskScore >= 50) {
      riskSignals.push({
        code: 'NEW_SUPPLIER_HIGH_AMOUNT',
        weight: 10,
        detail: `Proveedor con riesgo de maestro elevado (${context.supplier.riskScore}/100)`,
      });
    }

    const riskScore = Math.min(
      100,
      riskSignals.reduce((sum, signal) => sum + signal.weight, 0),
    );
    const riskBand: RiskBand =
      riskScore >= 70 ? 'critical' : riskScore >= 45 ? 'high' : riskScore >= 20 ? 'medium' : 'low';
    const blocking = exceptions.some((exception) => exception.blocksPayment);

    return {
      riskScore,
      riskBand,
      riskSignals,
      releaseRecommendation: blocking ? 'block' : riskScore >= 20 ? 'manual_review' : 'auto_release',
    };
  }

  private buildException(
    invoice: Invoice,
    rule: ToleranceRule,
    data: { title: string; message: string; observedValue: number; relatedInvoiceId?: string },
  ): InvoiceException {
    return {
      id: generateId('exc'),
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
      relatedInvoiceId: data.relatedInvoiceId,
    } as InvoiceException;
  }

  private rule(context: EvaluationContext, code: RuleCode): ToleranceRule | undefined {
    const rule = (context.profile.rules ?? []).find((candidate) => candidate.ruleCode === code);
    return rule?.enabled ? rule : undefined;
  }
}
