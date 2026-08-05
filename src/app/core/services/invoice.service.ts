import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import {
  AuditEvent,
  ConsolidationOpportunity,
  CreateInvoiceRequest,
  Invoice,
  InvoiceComparison,
  InvoiceComparisonField,
  InvoiceException,
  InvoiceLine
} from '../models/invoice.model';
import { InvoiceAnomalyService } from './invoice-anomaly.service';
import { ProcurementMasterDataService } from './procurement-master-data.service';
import { SpendClassificationService } from './spend-classification.service';

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private readonly STORAGE_KEY = 'supplier_invoices';

  private invoicesSubject = new BehaviorSubject<Invoice[]>([]);
  invoices$ = this.invoicesSubject.asObservable();

  constructor(
    private masterData: ProcurementMasterDataService,
    private classification: SpendClassificationService,
    private anomalies: InvoiceAnomalyService
  ) {
    this.load();
  }

  getInvoices(): Invoice[] {
    return this.invoicesSubject.value;
  }

  getInvoice(id: string): Invoice | undefined {
    return this.getInvoices().find(invoice => invoice.id === id);
  }

  getOpenExceptions(): InvoiceException[] {
    return this.getInvoices()
      .flatMap(invoice => invoice.exceptions)
      .filter(exception => exception.status === 'open' || exception.status === 'in_review');
  }

  getConsolidationOpportunities(): ConsolidationOpportunity[] {
    return this.classification.findConsolidationOpportunities(this.getInvoices());
  }

  previewInvoice(request: CreateInvoiceRequest): Invoice {
    const invoice = this.buildInvoice(request, 'preview');
    const evaluation = this.anomalies.evaluate(invoice, this.getInvoices());
    return {
      ...invoice,
      exceptions: evaluation.exceptions,
      duplicateCandidates: evaluation.duplicateCandidates,
      matchResult: evaluation.matchResult,
      riskAssessment: evaluation.riskAssessment
    };
  }

  createInvoice(request: CreateInvoiceRequest): Observable<Invoice> {
    const invoice = this.buildInvoice(request, this.generateId('inv'));
    const evaluation = this.anomalies.evaluate(invoice, this.getInvoices());
    const blocking = evaluation.exceptions.some(exception => exception.blocksPayment);
    const stored: Invoice = {
      ...invoice,
      exceptions: evaluation.exceptions.map(exception => ({ ...exception, invoiceId: invoice.id })),
      duplicateCandidates: evaluation.duplicateCandidates.map(candidate => ({ ...candidate, invoiceId: invoice.id })),
      matchResult: evaluation.matchResult,
      riskAssessment: { ...evaluation.riskAssessment, invoiceId: invoice.id },
      status: blocking ? 'blocked' : evaluation.exceptions.length ? 'under_review' : 'approved',
      auditTrail: [
        this.auditEvent(invoice.id, 'invoice_registered', `Origen ${request.source}`),
        ...(blocking ? [this.auditEvent(invoice.id, 'payment_blocked', 'Excepcion critica sobre tolerancia configurada')] : [])
      ]
    };

    this.persist([...this.getInvoices(), stored]);
    return of(stored);
  }

  resolveException(invoiceId: string, exceptionId: string, status: InvoiceException['status'], note?: string): void {
    const invoices = this.getInvoices().map(invoice => {
      if (invoice.id !== invoiceId) {
        return invoice;
      }
      const exceptions = invoice.exceptions.map(exception =>
        exception.id === exceptionId
          ? { ...exception, status, resolutionNote: note, resolvedAt: new Date() }
          : exception
      );
      const stillBlocking = exceptions.some(
        exception => exception.blocksPayment && (exception.status === 'open' || exception.status === 'in_review')
      );
      return {
        ...invoice,
        exceptions,
        status: stillBlocking ? 'blocked' : ('approved' as Invoice['status']),
        auditTrail: [...invoice.auditTrail, this.auditEvent(invoice.id, `exception_${status}`, note)],
        updatedAt: new Date()
      };
    });
    this.persist(invoices);
  }

  linkDevinSession(invoiceId: string, exceptionId: string, sessionId: string): void {
    const invoices = this.getInvoices().map(invoice =>
      invoice.id === invoiceId
        ? {
            ...invoice,
            exceptions: invoice.exceptions.map(exception =>
              exception.id === exceptionId ? { ...exception, devinSessionId: sessionId, status: 'in_review' as const } : exception
            ),
            auditTrail: [...invoice.auditTrail, this.auditEvent(invoice.id, 'devin_session_created', sessionId)]
          }
        : invoice
    );
    this.persist(invoices);
  }

  compare(leftId: string, rightId: string): InvoiceComparison | undefined {
    const left = this.getInvoice(leftId);
    const right = this.getInvoice(rightId);
    if (!left || !right) {
      return undefined;
    }

    const fields = this.buildComparisonFields(left, right);
    const { score } = this.anomalies.scoreDuplicate(left, right);
    return {
      left,
      right,
      fields,
      duplicateScore: score,
      duplicateVerdict: score >= 80 ? 'likely_duplicate' : score >= 50 ? 'needs_review' : 'different',
      matchedFields: fields.filter(field => field.equal).map(field => field.label),
      differingFields: fields.filter(field => !field.equal).map(field => field.label)
    };
  }

  resetToSeedData(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.invoicesSubject.next([]);
    this.seed();
  }

  private buildComparisonFields(left: Invoice, right: Invoice): InvoiceComparisonField[] {
    const numericField = (
      key: string,
      label: string,
      leftValue: number,
      rightValue: number,
      weight: number,
      relevance: InvoiceComparisonField['relevance']
    ): InvoiceComparisonField => {
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
        relevance
      };
    };

    const textField = (
      key: string,
      label: string,
      leftValue: string,
      rightValue: string,
      weight: number,
      relevance: InvoiceComparisonField['relevance']
    ): InvoiceComparisonField => ({
      key,
      label,
      leftValue: leftValue || '-',
      rightValue: rightValue || '-',
      equal: (leftValue || '').trim().toLowerCase() === (rightValue || '').trim().toLowerCase(),
      weight,
      relevance
    });

    return [
      textField('invoiceNumber', 'Numero de factura', left.invoiceNumber, right.invoiceNumber, 35, 'duplicate_signal'),
      textField('supplier', 'Proveedor', left.supplierName, right.supplierName, 20, 'duplicate_signal'),
      textField('supplierTaxId', 'NIF proveedor', left.supplierTaxId, right.supplierTaxId, 20, 'duplicate_signal'),
      textField('issueDate', 'Fecha de emision', this.formatDate(left.issueDate), this.formatDate(right.issueDate), 10, 'duplicate_signal'),
      textField('dueDate', 'Fecha de vencimiento', this.formatDate(left.dueDate), this.formatDate(right.dueDate), 5, 'informative'),
      textField('purchaseOrder', 'Pedido de compra', left.purchaseOrderNumber ?? '', right.purchaseOrderNumber ?? '', 5, 'duplicate_signal'),
      {
        key: 'bankAccount',
        label: 'IBAN de cobro',
        leftValue: this.maskIban(left.bankAccountIban),
        rightValue: this.maskIban(right.bankAccountIban),
        equal: left.bankAccountIban === right.bankAccountIban,
        weight: 5,
        relevance: 'fraud_signal'
      },
      textField('bankHolder', 'Titular de la cuenta', left.bankAccountHolder ?? '', right.bankAccountHolder ?? '', 5, 'fraud_signal'),
      textField('currency', 'Divisa', left.currency, right.currency, 5, 'fraud_signal'),
      numericField('subtotal', 'Base imponible', left.subtotal, right.subtotal, 10, 'duplicate_signal'),
      numericField('taxAmount', 'Impuestos', left.taxAmount, right.taxAmount, 5, 'informative'),
      numericField('totalAmount', 'Total factura', left.totalAmount, right.totalAmount, 25, 'duplicate_signal'),
      numericField('lineCount', 'Numero de lineas', left.lines.length, right.lines.length, 5, 'informative'),
      textField(
        'category',
        'Categoria de gasto',
        `${left.classification.categoryName} (${left.classification.confidence}%)`,
        `${right.classification.categoryName} (${right.classification.confidence}%)`,
        5,
        'informative'
      ),
      textField('costCenter', 'Centro de coste', left.costCenter, right.costCenter, 5, 'informative'),
      numericField('riskScore', 'Score de riesgo', left.riskAssessment.score, right.riskAssessment.score, 5, 'fraud_signal'),
      numericField('openExceptions', 'Excepciones abiertas', this.countOpen(left), this.countOpen(right), 5, 'fraud_signal'),
      textField('status', 'Estado', left.status, right.status, 5, 'informative')
    ];
  }

  private countOpen(invoice: Invoice): number {
    return invoice.exceptions.filter(exception => exception.status === 'open' || exception.status === 'in_review').length;
  }

  private buildInvoice(request: CreateInvoiceRequest, id: string): Invoice {
    const supplier = this.masterData.getSupplier(request.supplierId);
    const lines: InvoiceLine[] = request.lines.map((line, index) => {
      const categoryCode = this.classification.classifyLine(line, supplier);
      return {
        id: `${id}-l${index + 1}`,
        lineNumber: index + 1,
        itemCode: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
        unitPrice: line.unitPrice,
        lineTotal: this.round(line.quantity * line.unitPrice),
        taxRate: line.taxRate,
        categoryCode,
        glAccount: this.masterData.getCategory(categoryCode)?.glAccount,
        costCenter: line.costCenter ?? request.costCenter
      };
    });

    const linesSum = this.round(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const subtotal = request.declaredSubtotal ?? linesSum;
    const taxAmount = request.declaredTaxAmount ?? this.round((subtotal * request.taxRate) / 100);
    const totalAmount = request.declaredTotalAmount ?? this.round(subtotal + taxAmount);

    const classification = this.classification.classify(request.lines, supplier, request.description, request.manualCategoryCode);

    return {
      id,
      invoiceNumber: request.invoiceNumber.trim(),
      supplierId: request.supplierId,
      supplierName: supplier?.legalName ?? request.supplierId,
      supplierTaxId: supplier?.taxId ?? '',
      purchaseOrderNumber: request.purchaseOrderNumber?.trim() || undefined,
      contractReference: request.contractReference?.trim() || undefined,
      issueDate: new Date(request.issueDate),
      receivedDate: new Date(request.receivedDate),
      dueDate: new Date(request.dueDate),
      currency: request.currency,
      exchangeRate: request.exchangeRate,
      subtotal,
      taxRate: request.taxRate,
      taxAmount,
      totalAmount,
      paymentTermsDays: request.paymentTermsDays,
      paymentMethod: request.paymentMethod,
      bankAccountIban: request.bankAccountIban.replace(/\s/g, '').toUpperCase(),
      bankAccountHolder: request.bankAccountHolder,
      costCenter: request.costCenter,
      requesterEmail: request.requesterEmail,
      description: request.description,
      source: request.source,
      status: 'registered',
      lines,
      classification,
      riskAssessment: {
        invoiceId: id,
        score: 0,
        band: 'low',
        signals: [],
        evaluatedAt: new Date(),
        releaseRecommendation: 'auto_release'
      },
      exceptions: [],
      duplicateCandidates: [],
      auditTrail: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private auditEvent(invoiceId: string, action: string, detail?: string): AuditEvent {
    return {
      id: this.generateId('aud'),
      invoiceId,
      action,
      actor: 'compras.operador',
      at: new Date(),
      detail
    };
  }

  private persist(invoices: Invoice[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(invoices));
    this.invoicesSubject.next(invoices);
  }

  private load(): void {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      this.seed();
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Invoice[];
      this.invoicesSubject.next(parsed.map(invoice => this.reviveDates(invoice)));
    } catch {
      this.seed();
    }
  }

  private reviveDates(invoice: Invoice): Invoice {
    return {
      ...invoice,
      issueDate: new Date(invoice.issueDate),
      receivedDate: new Date(invoice.receivedDate),
      dueDate: new Date(invoice.dueDate),
      createdAt: new Date(invoice.createdAt),
      updatedAt: new Date(invoice.updatedAt),
      riskAssessment: { ...invoice.riskAssessment, evaluatedAt: new Date(invoice.riskAssessment.evaluatedAt) },
      exceptions: invoice.exceptions.map(exception => ({ ...exception, detectedAt: new Date(exception.detectedAt) })),
      auditTrail: (invoice.auditTrail ?? []).map(event => ({ ...event, at: new Date(event.at) }))
    };
  }

  private seed(): void {
    this.seedRequests().forEach(request => this.createInvoice(request));
  }

  private seedRequests(): CreateInvoiceRequest[] {
    return [
      {
        invoiceNumber: 'NIM-2026-0741',
        supplierId: 'sup-001',
        purchaseOrderNumber: 'PO-2026-0453',
        contractReference: 'CTR-CLOUD-2026',
        issueDate: '2026-07-01',
        receivedDate: '2026-07-03',
        dueDate: '2026-08-30',
        currency: 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: 60,
        paymentMethod: 'transfer',
        bankAccountIban: 'ES9121000418450200051332',
        bankAccountHolder: 'Nimbus Cloud Services S.L.',
        costCenter: 'CC-IT-INFRA',
        requesterEmail: 'infra.lead@empresa.example',
        description: 'Servicios cloud junio 2026',
        source: 'edi',
        lines: [
          {
            itemCode: 'CLOUD-VM-M',
            description: 'Instancia computo mediana',
            quantity: 100,
            uom: 'unidad/mes',
            unitPrice: 120,
            taxRate: 21
          },
          {
            itemCode: 'CLOUD-STG-TB',
            description: 'Almacenamiento objeto',
            quantity: 250,
            uom: 'TB/mes',
            unitPrice: 18,
            taxRate: 21
          }
        ]
      },
      {
        invoiceNumber: 'NIM 2026 0741',
        supplierId: 'sup-001',
        purchaseOrderNumber: 'PO-2026-0453',
        contractReference: 'CTR-CLOUD-2026',
        issueDate: '2026-07-01',
        receivedDate: '2026-07-18',
        dueDate: '2026-08-30',
        currency: 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: 60,
        paymentMethod: 'transfer',
        bankAccountIban: 'ES9121000418450200051332',
        bankAccountHolder: 'Nimbus Cloud Services S.L.',
        costCenter: 'CC-IT-INFRA',
        description: 'Servicios cloud junio 2026 (reenvio del proveedor)',
        source: 'email',
        lines: [
          {
            itemCode: 'CLOUD-VM-M',
            description: 'Instancia computo mediana',
            quantity: 100,
            uom: 'unidad/mes',
            unitPrice: 120,
            taxRate: 21
          },
          {
            itemCode: 'CLOUD-STG-TB',
            description: 'Almacenamiento objeto',
            quantity: 250,
            uom: 'TB/mes',
            unitPrice: 18,
            taxRate: 21
          }
        ]
      },
      {
        invoiceNumber: 'DS-9931',
        supplierId: 'sup-002',
        purchaseOrderNumber: 'PO-2026-0511',
        contractReference: 'CTR-SAAS-2026',
        issueDate: '2026-07-10',
        receivedDate: '2026-07-28',
        dueDate: '2026-08-09',
        currency: 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: 30,
        paymentMethod: 'transfer',
        bankAccountIban: 'LT601010012345678901',
        bankAccountHolder: 'Delta Soft Ltd',
        costCenter: 'CC-IT-APPS',
        description: 'Renovacion licencias CRM Q3',
        source: 'email',
        lines: [
          {
            itemCode: 'LIC-CRM-USR',
            description: 'Licencia CRM por usuario',
            quantity: 600,
            uom: 'usuario/mes',
            unitPrice: 52,
            taxRate: 21
          }
        ]
      },
      {
        invoiceNumber: 'ORI-2026-118',
        supplierId: 'sup-003',
        issueDate: '2026-07-20',
        receivedDate: '2026-07-22',
        dueDate: '2026-09-05',
        currency: 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: 45,
        paymentMethod: 'transfer',
        bankAccountIban: 'ES6000491500051234567892',
        bankAccountHolder: 'Consultoria Orion S.L.',
        costCenter: 'CC-IT-APPS',
        description: 'Bolsa de horas de desarrollo julio',
        source: 'manual',
        lines: [
          {
            itemCode: 'SRV-DEV-SR',
            description: 'Jornada desarrollador senior',
            quantity: 22,
            uom: 'jornada',
            unitPrice: 545,
            taxRate: 21
          }
        ]
      },
      {
        invoiceNumber: 'TR-2026-0004',
        supplierId: 'sup-004',
        issueDate: '2026-07-25',
        receivedDate: '2026-07-26',
        dueDate: '2026-08-25',
        currency: 'EUR',
        exchangeRate: 1,
        taxRate: 21,
        paymentTermsDays: 30,
        paymentMethod: 'transfer',
        bankAccountIban: 'ES1000751234560123456789',
        bankAccountHolder: 'Telered Comunicaciones S.L.',
        costCenter: 'CC-IT-INFRA',
        description: 'Lineas moviles y fibra corporativa',
        source: 'supplier_portal',
        lines: [
          {
            description: 'Lineas moviles datos corporativos',
            quantity: 400,
            uom: 'linea/mes',
            unitPrice: 29,
            taxRate: 21
          },
          {
            description: 'Fibra dedicada sede central',
            quantity: 1,
            uom: 'mes',
            unitPrice: 2600,
            taxRate: 21
          }
        ]
      }
    ];
  }

  private formatDate(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private maskIban(iban: string): string {
    const clean = (iban ?? '').replace(/\s/g, '').toUpperCase();
    return clean.length > 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : clean;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }
}
