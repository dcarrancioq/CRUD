import { Invoice } from './entities/invoice.entity';

/**
 * La API expone la clasificacion y el riesgo como objetos anidados (como en el modelo
 * de dominio), aunque en la tabla `invoices` viven como columnas para poder filtrar
 * y agregar por ellas.
 */
export function toInvoiceResponse(invoice: Invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    supplierId: invoice.supplierId,
    supplierName: invoice.supplierName,
    supplierTaxId: invoice.supplierTaxId,
    purchaseOrderNumber: invoice.purchaseOrderNumber ?? undefined,
    contractReference: invoice.contractReference ?? undefined,
    issueDate: invoice.issueDate,
    receivedDate: invoice.receivedDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    paymentTermsDays: invoice.paymentTermsDays,
    paymentMethod: invoice.paymentMethod,
    bankAccountIban: invoice.bankAccountIban,
    bankAccountHolder: invoice.bankAccountHolder ?? undefined,
    costCenter: invoice.costCenter,
    companyId: invoice.companyId ?? undefined,
    orgUnitId: invoice.orgUnitId ?? undefined,
    allocations: (invoice.allocations ?? []).map((allocation) => ({
      id: allocation.id,
      companyId: allocation.companyId,
      companyName: allocation.companyName,
      orgUnitId: allocation.orgUnitId,
      orgUnitName: allocation.orgUnitName,
      costCenterCode: allocation.costCenterCode,
      costCenterName: allocation.costCenterName ?? undefined,
      categoryCode: allocation.categoryCode,
      categoryName: allocation.categoryName ?? undefined,
      mode: allocation.mode,
      percent: allocation.percent,
      amount: allocation.amount,
    })),
    requesterEmail: invoice.requesterEmail ?? undefined,
    description: invoice.description ?? undefined,
    source: invoice.source,
    status: invoice.status,
    lines: [...(invoice.lines ?? [])].sort((a, b) => a.lineNumber - b.lineNumber),
    classification: {
      categoryCode: invoice.categoryCode,
      categoryName: invoice.categoryName,
      glAccount: invoice.glAccount,
      confidence: invoice.classificationConfidence,
      method: invoice.classificationMethod,
      matchedKeywords: invoice.classificationKeywords ?? [],
    },
    matchResult: invoice.matchResult ?? undefined,
    riskAssessment: {
      invoiceId: invoice.id,
      score: invoice.riskScore,
      band: invoice.riskBand,
      signals: invoice.riskSignals ?? [],
      evaluatedAt: invoice.riskEvaluatedAt,
      releaseRecommendation: invoice.releaseRecommendation,
    },
    exceptions: (invoice.exceptions ?? []).map((exception) => ({
      ...exception,
      invoice: undefined,
    })),
    duplicateCandidates: (invoice.duplicateCandidates ?? []).map((candidate) => ({
      ...candidate,
      invoice: undefined,
    })),
    auditTrail: [...(invoice.auditTrail ?? [])]
      .map((event) => ({ ...event, invoice: undefined }))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()),
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export type InvoiceResponse = ReturnType<typeof toInvoiceResponse>;
