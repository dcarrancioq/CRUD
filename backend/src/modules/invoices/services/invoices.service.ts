import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MasterDataService } from '../../master-data/master-data.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { AuditEvent } from '../entities/audit-event.entity';
import { InvoiceException } from '../entities/invoice-exception.entity';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { Invoice } from '../entities/invoice.entity';
import { ConsolidationOpportunity } from '../invoice.types';
import { generateId, normalizeIban, round } from '../invoice.utils';
import { EvaluationContext, InvoiceAnomalyService } from './invoice-anomaly.service';
import { InvoiceComparison, InvoiceComparisonService } from './invoice-comparison.service';
import { SpendClassificationService } from './spend-classification.service';

const PREVIEW_INVOICE_ID = 'preview';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceException) private readonly exceptions: Repository<InvoiceException>,
    @InjectRepository(AuditEvent) private readonly auditEvents: Repository<AuditEvent>,
    private readonly masterData: MasterDataService,
    private readonly classification: SpendClassificationService,
    private readonly anomalies: InvoiceAnomalyService,
    private readonly comparison: InvoiceComparisonService,
  ) {}

  findAll(): Promise<Invoice[]> {
    return this.invoices.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoices.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Factura ${id} no encontrada`);
    }
    return invoice;
  }

  async findOpenExceptions(): Promise<InvoiceException[]> {
    const invoices = await this.findAll();
    return invoices
      .flatMap((invoice) => invoice.exceptions ?? [])
      .filter((exception) => exception.status === 'open' || exception.status === 'in_review');
  }

  /** Evalua la factura contra las tolerancias sin persistir nada (pantalla de alta). */
  async preview(dto: CreateInvoiceDto): Promise<Invoice> {
    const { invoice } = await this.buildAndEvaluate(dto, PREVIEW_INVOICE_ID);
    return invoice;
  }

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const { invoice, blocking } = await this.buildAndEvaluate(dto, generateId('inv'));

    invoice.status = blocking ? 'blocked' : invoice.exceptions.length ? 'under_review' : 'approved';
    invoice.auditTrail = [
      this.auditEvent(invoice.id, 'invoice_registered', `Origen ${dto.source}`),
      ...(blocking
        ? [
            this.auditEvent(
              invoice.id,
              'payment_blocked',
              'Excepcion critica sobre la tolerancia configurada',
            ),
          ]
        : []),
    ];

    await this.invoices.save(invoice);
    return this.findOne(invoice.id);
  }

  async resolveException(
    invoiceId: string,
    exceptionId: string,
    status: InvoiceException['status'],
    note?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(invoiceId);
    const exception = (invoice.exceptions ?? []).find((candidate) => candidate.id === exceptionId);
    if (!exception) {
      throw new NotFoundException(`Excepcion ${exceptionId} no encontrada en la factura ${invoiceId}`);
    }

    exception.status = status;
    exception.resolutionNote = note;
    exception.resolvedAt = new Date();
    await this.exceptions.save(exception);

    const stillBlocking = (invoice.exceptions ?? []).some(
      (candidate) =>
        candidate.blocksPayment && (candidate.status === 'open' || candidate.status === 'in_review'),
    );
    invoice.status = stillBlocking ? 'blocked' : 'approved';
    await this.invoices.save(invoice);
    await this.auditEvents.save(this.auditEvent(invoiceId, `exception_${status}`, note));

    return this.findOne(invoiceId);
  }

  async linkDevinSession(
    invoiceId: string,
    exceptionId: string,
    sessionId: string,
    sessionUrl?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(invoiceId);
    const exception = (invoice.exceptions ?? []).find((candidate) => candidate.id === exceptionId);
    if (!exception) {
      throw new NotFoundException(`Excepcion ${exceptionId} no encontrada en la factura ${invoiceId}`);
    }

    exception.devinSessionId = sessionId;
    exception.status = 'in_review';
    await this.exceptions.save(exception);
    await this.auditEvents.save(
      this.auditEvent(invoiceId, 'devin_session_created', sessionUrl ?? sessionId),
    );

    return this.findOne(invoiceId);
  }

  async compare(leftId: string, rightId: string): Promise<InvoiceComparison> {
    const [left, right] = await Promise.all([this.findOne(leftId), this.findOne(rightId)]);
    return this.comparison.compare(left, right);
  }

  async findConsolidationOpportunities(): Promise<ConsolidationOpportunity[]> {
    const [invoices, categories] = await Promise.all([
      this.findAll(),
      this.masterData.findCategories(),
    ]);
    return this.classification.findConsolidationOpportunities(invoices, categories);
  }

  private async buildAndEvaluate(
    dto: CreateInvoiceDto,
    id: string,
  ): Promise<{ invoice: Invoice; blocking: boolean }> {
    const [profile, categories, supplier, history] = await Promise.all([
      this.masterData.findToleranceProfile(),
      this.masterData.findCategories(),
      this.masterData.findSupplier(dto.supplierId),
      this.findAll(),
    ]);
    const [contracts, purchaseOrder] = await Promise.all([
      this.masterData.findContractsBySupplier(dto.supplierId),
      dto.purchaseOrderNumber
        ? this.masterData.findPurchaseOrderByNumber(dto.purchaseOrderNumber.trim())
        : Promise.resolve(null),
    ]);

    const invoice = this.invoices.create({ id });
    const classification = this.classification.classify(
      categories,
      dto.lines,
      supplier,
      dto.description,
      dto.manualCategoryCode,
    );

    invoice.lines = dto.lines.map((line, index) => {
      const categoryCode = this.classification.classifyLine(categories, line, supplier);
      return {
        id: `${id}-l${index + 1}`,
        invoiceId: id,
        lineNumber: index + 1,
        itemCode: line.itemCode,
        description: line.description,
        quantity: line.quantity,
        uom: line.uom,
        unitPrice: line.unitPrice,
        lineTotal: round(line.quantity * line.unitPrice),
        taxRate: line.taxRate,
        categoryCode,
        glAccount: categories.find((category) => category.code === categoryCode)?.glAccount,
        costCenter: line.costCenter ?? dto.costCenter,
      } as InvoiceLine;
    });

    const linesSum = round(invoice.lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const subtotal = dto.declaredSubtotal ?? linesSum;
    const taxAmount = dto.declaredTaxAmount ?? round((subtotal * dto.taxRate) / 100);

    Object.assign(invoice, {
      invoiceNumber: dto.invoiceNumber.trim(),
      supplierId: dto.supplierId,
      supplierName: supplier?.legalName ?? dto.supplierId,
      supplierTaxId: supplier?.taxId ?? '',
      purchaseOrderNumber: dto.purchaseOrderNumber?.trim() || null,
      contractReference: dto.contractReference?.trim() || null,
      issueDate: new Date(dto.issueDate),
      receivedDate: new Date(dto.receivedDate),
      dueDate: new Date(dto.dueDate),
      currency: dto.currency,
      exchangeRate: dto.exchangeRate,
      subtotal,
      taxRate: dto.taxRate,
      taxAmount,
      totalAmount: dto.declaredTotalAmount ?? round(subtotal + taxAmount),
      paymentTermsDays: dto.paymentTermsDays,
      paymentMethod: dto.paymentMethod,
      bankAccountIban: normalizeIban(dto.bankAccountIban),
      bankAccountHolder: dto.bankAccountHolder ?? null,
      costCenter: dto.costCenter,
      requesterEmail: dto.requesterEmail ?? null,
      description: dto.description ?? null,
      source: dto.source,
      status: 'registered',
      categoryCode: classification.categoryCode,
      categoryName: classification.categoryName,
      glAccount: classification.glAccount,
      classificationConfidence: classification.confidence,
      classificationMethod: classification.method,
      classificationKeywords: classification.matchedKeywords,
      auditTrail: [],
    });

    const context: EvaluationContext = { profile, supplier, contracts, purchaseOrder, history };
    const evaluation = this.anomalies.evaluate(invoice, context);

    invoice.exceptions = evaluation.exceptions;
    invoice.duplicateCandidates = evaluation.duplicateCandidates;
    invoice.matchResult = evaluation.matchResult;
    invoice.riskScore = evaluation.riskScore;
    invoice.riskBand = evaluation.riskBand;
    invoice.riskSignals = evaluation.riskSignals;
    invoice.releaseRecommendation = evaluation.releaseRecommendation;
    invoice.riskEvaluatedAt = new Date();

    return {
      invoice,
      blocking: evaluation.exceptions.some((exception) => exception.blocksPayment),
    };
  }

  private auditEvent(invoiceId: string, action: string, detail?: string): AuditEvent {
    return {
      id: generateId('aud'),
      invoiceId,
      action,
      actor: 'compras.operador',
      at: new Date(),
      detail,
    } as AuditEvent;
  }
}
