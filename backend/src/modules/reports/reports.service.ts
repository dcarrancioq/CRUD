import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BankAccountChange } from '../master-data/entities/bank-account-change.entity';
import { MasterDataService } from '../master-data/master-data.service';
import { DuplicateCandidate } from '../invoices/entities/duplicate-candidate.entity';
import { InvoiceException } from '../invoices/entities/invoice-exception.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { formatDate, round } from '../invoices/invoice.utils';
import {
  BudgetStatus,
  SupplierReport,
  SupplierReportAlert,
  SupplierReportCategory,
  SupplierReportDeviation,
  SupplierReportMonth,
} from './report.types';

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  status: string;
  riskScore: number;
  categoryCode: string;
  categoryName: string;
  purchaseOrderNumber: string | null;
  paymentTermsDays: number;
}

/**
 * Informe de seguimiento por proveedor y ejercicio: consumo frente a presupuesto,
 * evolucion mensual, desviaciones frente a contrato/historico y alertas derivadas
 * de las excepciones ya calculadas por el motor determinista.
 */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceException) private readonly exceptions: Repository<InvoiceException>,
    @InjectRepository(DuplicateCandidate) private readonly duplicates: Repository<DuplicateCandidate>,
    @InjectRepository(BankAccountChange) private readonly bankAccountChanges: Repository<BankAccountChange>,
    private readonly masterData: MasterDataService,
  ) {}

  async availableYears(): Promise<number[]> {
    const budgetYears = await this.masterData.findBudgetYears();
    const rows = await this.invoices
      .createQueryBuilder('invoice')
      .select('DISTINCT EXTRACT(YEAR FROM invoice.issue_date)::int', 'year')
      .orderBy('year', 'DESC')
      .getRawMany<{ year: number }>();
    const years = new Set<number>([...budgetYears, ...rows.map((row) => Number(row.year))]);
    if (!years.size) {
      years.add(new Date().getFullYear());
    }
    return [...years].sort((a, b) => b - a);
  }

  async supplierReport(supplierId: string, fiscalYear: number): Promise<SupplierReport> {
    const supplier = await this.masterData.findSupplierOrFail(supplierId);
    const budgetRecord = await this.masterData.findBudget(supplierId, fiscalYear);
    const contracts = await this.masterData.findContractsBySupplier(supplierId);
    const rows = await this.invoiceRows(supplierId, fiscalYear);

    const consumedAmount = round(rows.reduce((total, row) => total + row.totalAmount, 0));
    const blockedAmount = round(
      rows.filter((row) => row.status === 'blocked').reduce((total, row) => total + row.totalAmount, 0),
    );
    const budgetAmount = budgetRecord?.budgetAmount ?? 0;
    const alertThreshold = budgetRecord?.alertThresholdPercent ?? 85;
    const consumedPercent = budgetAmount ? round((consumedAmount / budgetAmount) * 100) : 0;
    const monthsElapsed = this.monthsElapsed(fiscalYear);
    const forecast = monthsElapsed ? round((consumedAmount / monthsElapsed) * 12) : consumedAmount;

    const openExceptions = await this.countExceptions(supplierId, fiscalYear);
    const duplicateCandidates = await this.countDuplicates(supplierId, fiscalYear);
    const changes = await this.bankAccountChanges.find({ where: { supplierId } });
    const previousYearAmount = await this.yearTotal(supplierId, fiscalYear - 1);
    const invoicesWithExceptions = await this.countInvoicesWithExceptions(supplierId, fiscalYear);

    const monthly = this.buildMonthly(rows, budgetAmount, fiscalYear);
    const categories = this.buildCategories(rows, consumedAmount);
    const status = this.budgetStatus(budgetRecord ? budgetAmount : 0, consumedPercent, alertThreshold);
    const contractTerms = contracts.length ? contracts[0].paymentTermsDays : undefined;
    const avgPaymentTerms = rows.length
      ? round(rows.reduce((total, row) => total + row.paymentTermsDays, 0) / rows.length)
      : 0;
    const avgRisk = rows.length
      ? round(rows.reduce((total, row) => total + row.riskScore, 0) / rows.length)
      : 0;
    const withoutPo = rows.filter((row) => !row.purchaseOrderNumber).length;

    const deviations = this.buildDeviations({
      budgetAmount,
      consumedAmount,
      forecast,
      previousYearAmount,
      avgPaymentTerms,
      contractTerms,
      committedAnnualSpend: contracts.reduce((total, contract) => total + contract.committedAnnualSpend, 0),
    });

    const alerts = this.buildAlerts({
      supplierName: supplier.legalName,
      fiscalYear,
      budgetAmount,
      consumedAmount,
      consumedPercent,
      alertThreshold,
      forecast,
      blockedAmount,
      openExceptions,
      duplicateCandidates,
      recentBankChanges: changes.filter((change) => this.isRecent(change.changedAt, 180)).length,
      withoutPo,
      invoiceCount: rows.length,
    });

    return {
      supplier: {
        id: supplier.id,
        taxId: supplier.taxId,
        legalName: supplier.legalName,
        status: supplier.status,
        onboardedAt: formatDate(supplier.onboardedAt),
        paymentTermsDays: supplier.paymentTermsDays,
        riskScore: supplier.riskScore,
        contactEmail: supplier.contactEmail ?? undefined,
      },
      fiscalYear,
      generatedAt: new Date().toISOString(),
      budget: budgetRecord
        ? {
            amount: budgetAmount,
            currency: budgetRecord.currency,
            alertThresholdPercent: alertThreshold,
            ownerEmail: budgetRecord.ownerEmail ?? undefined,
            notes: budgetRecord.notes ?? undefined,
          }
        : undefined,
      consumption: {
        invoiceCount: rows.length,
        consumedAmount,
        blockedAmount,
        consumedPercent,
        remainingAmount: round(budgetAmount - consumedAmount),
        deviationAmount: round(consumedAmount - budgetAmount),
        deviationPercent: budgetAmount ? round(((consumedAmount - budgetAmount) / budgetAmount) * 100) : 0,
        forecastYearEndAmount: forecast,
        forecastDeviationPercent: budgetAmount ? round(((forecast - budgetAmount) / budgetAmount) * 100) : 0,
        status,
      },
      monthly,
      categories,
      tracking: {
        avgInvoiceAmount: rows.length ? round(consumedAmount / rows.length) : 0,
        maxInvoiceAmount: rows.length ? round(Math.max(...rows.map((row) => row.totalAmount))) : 0,
        avgPaymentTermsDays: avgPaymentTerms,
        contractPaymentTermsDays: contractTerms,
        avgRiskScore: avgRisk,
        exceptionRatePercent: rows.length ? round((invoicesWithExceptions / rows.length) * 100) : 0,
        openExceptions,
        blockedInvoices: rows.filter((row) => row.status === 'blocked').length,
        invoicesWithoutPurchaseOrder: withoutPo,
        duplicateCandidates,
        bankAccountChanges: changes.length,
        lastInvoiceDate: rows.length ? rows[0].issueDate : undefined,
        previousYearAmount,
        yoyVariationPercent: previousYearAmount
          ? round(((consumedAmount - previousYearAmount) / previousYearAmount) * 100)
          : undefined,
      },
      deviations,
      alerts,
      invoices: await this.recentInvoices(rows, supplierId, fiscalYear),
    };
  }

  private async invoiceRows(supplierId: string, fiscalYear: number): Promise<InvoiceRow[]> {
    const rows = await this.invoices
      .createQueryBuilder('invoice')
      .select([
        'invoice.id AS id',
        'invoice.invoice_number AS "invoiceNumber"',
        'invoice.issue_date AS "issueDate"',
        'invoice.total_amount AS "totalAmount"',
        'invoice.status AS status',
        'invoice.risk_score AS "riskScore"',
        'invoice.category_code AS "categoryCode"',
        'invoice.category_name AS "categoryName"',
        'invoice.purchase_order_number AS "purchaseOrderNumber"',
        'invoice.payment_terms_days AS "paymentTermsDays"',
      ])
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .orderBy('invoice.issue_date', 'DESC')
      .getRawMany<InvoiceRow>();

    return rows.map((row) => ({
      ...row,
      issueDate: formatDate(row.issueDate),
      totalAmount: Number(row.totalAmount),
      riskScore: Number(row.riskScore),
      paymentTermsDays: Number(row.paymentTermsDays),
    }));
  }

  private async recentInvoices(rows: InvoiceRow[], supplierId: string, fiscalYear: number) {
    const openByInvoice = await this.exceptions
      .createQueryBuilder('exception')
      .innerJoin(Invoice, 'invoice', 'invoice.id = exception.invoice_id')
      .select('exception.invoice_id', 'invoiceId')
      .addSelect('COUNT(*)::int', 'total')
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .andWhere("exception.status IN ('open', 'in_review')")
      .groupBy('exception.invoice_id')
      .getRawMany<{ invoiceId: string; total: number }>();

    const openMap = new Map(openByInvoice.map((row) => [row.invoiceId, Number(row.total)]));

    return rows.slice(0, 25).map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      issueDate: row.issueDate,
      totalAmount: row.totalAmount,
      status: row.status,
      riskScore: row.riskScore,
      categoryName: row.categoryName,
      openExceptions: openMap.get(row.id) ?? 0,
    }));
  }

  private buildMonthly(rows: InvoiceRow[], budgetAmount: number, fiscalYear: number): SupplierReportMonth[] {
    const monthlyBudget = budgetAmount / 12;
    let cumulative = 0;

    return MONTH_LABELS.map((label, index) => {
      const month = index + 1;
      const monthRows = rows.filter((row) => Number(row.issueDate.slice(5, 7)) === month);
      const amount = round(monthRows.reduce((total, row) => total + row.totalAmount, 0));
      cumulative = round(cumulative + amount);
      const budgetCumulative = round(monthlyBudget * month);

      return {
        month,
        label: `${label} ${fiscalYear}`,
        invoiceCount: monthRows.length,
        amount,
        cumulativeAmount: cumulative,
        budgetCumulativeAmount: budgetCumulative,
        deviationPercent: budgetCumulative
          ? round(((cumulative - budgetCumulative) / budgetCumulative) * 100)
          : 0,
      };
    });
  }

  private buildCategories(rows: InvoiceRow[], consumedAmount: number): SupplierReportCategory[] {
    const byCategory = new Map<string, SupplierReportCategory>();

    for (const row of rows) {
      const current = byCategory.get(row.categoryCode) ?? {
        categoryCode: row.categoryCode,
        categoryName: row.categoryName,
        invoiceCount: 0,
        amount: 0,
        sharePercent: 0,
      };
      current.invoiceCount += 1;
      current.amount = round(current.amount + row.totalAmount);
      byCategory.set(row.categoryCode, current);
    }

    return [...byCategory.values()]
      .map((category) => ({
        ...category,
        sharePercent: consumedAmount ? round((category.amount / consumedAmount) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private buildDeviations(input: {
    budgetAmount: number;
    consumedAmount: number;
    forecast: number;
    previousYearAmount: number;
    avgPaymentTerms: number;
    contractTerms?: number;
    committedAnnualSpend: number;
  }): SupplierReportDeviation[] {
    const deviations: SupplierReportDeviation[] = [];

    if (input.budgetAmount) {
      deviations.push({
        code: 'BUDGET_CONSUMPTION',
        label: 'Consumo frente a presupuesto',
        value: input.consumedAmount,
        reference: input.budgetAmount,
        deviationPercent: round(((input.consumedAmount - input.budgetAmount) / input.budgetAmount) * 100),
        comment: 'Gasto facturado del ejercicio contra el presupuesto asignado al proveedor.',
      });
      deviations.push({
        code: 'BUDGET_FORECAST',
        label: 'Proyeccion a cierre de ejercicio',
        value: input.forecast,
        reference: input.budgetAmount,
        deviationPercent: round(((input.forecast - input.budgetAmount) / input.budgetAmount) * 100),
        comment: 'Extrapolacion lineal del consumo medio mensual hasta diciembre.',
      });
    }

    if (input.previousYearAmount) {
      deviations.push({
        code: 'YOY_SPEND',
        label: 'Variacion frente al ejercicio anterior',
        value: input.consumedAmount,
        reference: input.previousYearAmount,
        deviationPercent: round(
          ((input.consumedAmount - input.previousYearAmount) / input.previousYearAmount) * 100,
        ),
        comment: 'Comparativa con el gasto facturado por el mismo proveedor el ano anterior.',
      });
    }

    if (input.committedAnnualSpend) {
      deviations.push({
        code: 'CONTRACT_COMMITMENT',
        label: 'Consumo frente al compromiso contratado',
        value: input.consumedAmount,
        reference: input.committedAnnualSpend,
        deviationPercent: round(
          ((input.consumedAmount - input.committedAnnualSpend) / input.committedAnnualSpend) * 100,
        ),
        comment: 'Compromiso anual agregado de los contratos vigentes del proveedor.',
      });
    }

    if (input.contractTerms) {
      deviations.push({
        code: 'PAYMENT_TERMS',
        label: 'Condiciones de pago medias vs contrato',
        value: input.avgPaymentTerms,
        reference: input.contractTerms,
        deviationPercent: round(
          ((input.avgPaymentTerms - input.contractTerms) / input.contractTerms) * 100,
        ),
        comment: 'Dias de pago medios facturados frente a los pactados en contrato.',
      });
    }

    return deviations;
  }

  private buildAlerts(input: {
    supplierName: string;
    fiscalYear: number;
    budgetAmount: number;
    consumedAmount: number;
    consumedPercent: number;
    alertThreshold: number;
    forecast: number;
    blockedAmount: number;
    openExceptions: number;
    duplicateCandidates: number;
    recentBankChanges: number;
    withoutPo: number;
    invoiceCount: number;
  }): SupplierReportAlert[] {
    const alerts: SupplierReportAlert[] = [];

    if (!input.budgetAmount) {
      alerts.push({
        code: 'BUDGET_MISSING',
        severity: 'warning',
        title: 'Sin presupuesto asignado',
        message: `No hay presupuesto ${input.fiscalYear} para ${input.supplierName}: el gasto no se puede controlar contra budget.`,
      });
    } else if (input.consumedPercent >= 100) {
      alerts.push({
        code: 'BUDGET_EXCEEDED',
        severity: 'critical',
        title: 'Presupuesto agotado',
        message: `Consumido el ${input.consumedPercent}% del presupuesto (${input.consumedAmount} de ${input.budgetAmount}). Requiere ampliacion o parada de pedidos.`,
      });
    } else if (input.consumedPercent >= input.alertThreshold) {
      alerts.push({
        code: 'BUDGET_NEAR_LIMIT',
        severity: 'warning',
        title: 'Presupuesto cerca del limite',
        message: `Consumido el ${input.consumedPercent}%, por encima del umbral de aviso del ${input.alertThreshold}%.`,
      });
    }

    if (input.budgetAmount && input.forecast > input.budgetAmount && input.consumedPercent < 100) {
      alerts.push({
        code: 'BUDGET_FORECAST_OVERRUN',
        severity: 'warning',
        title: 'Proyeccion por encima del presupuesto',
        message: `Al ritmo actual el cierre estimado es ${input.forecast}, un ${round(((input.forecast - input.budgetAmount) / input.budgetAmount) * 100)}% sobre presupuesto.`,
      });
    }

    if (input.blockedAmount > 0) {
      alerts.push({
        code: 'BLOCKED_PAYMENTS',
        severity: 'critical',
        title: 'Pagos bloqueados',
        message: `Hay ${input.blockedAmount} en facturas con el pago bloqueado por excepciones criticas.`,
      });
    }

    if (input.duplicateCandidates > 0) {
      alerts.push({
        code: 'DUPLICATES',
        severity: 'critical',
        title: 'Posibles facturas duplicadas',
        message: `${input.duplicateCandidates} candidatos de duplicado detectados en el ejercicio.`,
      });
    }

    if (input.recentBankChanges > 0) {
      alerts.push({
        code: 'BANK_CHANGES',
        severity: 'warning',
        title: 'Cambios recientes de cuenta bancaria',
        message: `${input.recentBankChanges} cambio(s) de cuenta en los ultimos 180 dias: verificar antes de liberar pagos.`,
      });
    }

    if (input.openExceptions > 0) {
      alerts.push({
        code: 'OPEN_EXCEPTIONS',
        severity: 'info',
        title: 'Excepciones pendientes de revision',
        message: `${input.openExceptions} excepcion(es) abiertas o en revision sobre facturas de este proveedor.`,
      });
    }

    if (input.invoiceCount && input.withoutPo / input.invoiceCount > 0.3) {
      alerts.push({
        code: 'MAVERICK_SPEND',
        severity: 'warning',
        title: 'Gasto sin pedido de compra',
        message: `${input.withoutPo} de ${input.invoiceCount} facturas llegan sin PO asociada (maverick spend).`,
      });
    }

    return alerts;
  }

  private budgetStatus(budgetAmount: number, consumedPercent: number, threshold: number): BudgetStatus {
    if (!budgetAmount) {
      return 'no_budget';
    }
    if (consumedPercent >= 100) {
      return 'exceeded';
    }
    return consumedPercent >= threshold ? 'warning' : 'on_track';
  }

  private monthsElapsed(fiscalYear: number): number {
    const now = new Date();
    if (fiscalYear < now.getFullYear()) {
      return 12;
    }
    if (fiscalYear > now.getFullYear()) {
      return 0;
    }
    return now.getMonth() + 1;
  }

  private isRecent(value: Date | string, days: number): boolean {
    const changed = new Date(value).getTime();
    return Date.now() - changed <= days * 24 * 60 * 60 * 1000;
  }

  private async countExceptions(supplierId: string, fiscalYear: number): Promise<number> {
    return this.exceptions
      .createQueryBuilder('exception')
      .innerJoin(Invoice, 'invoice', 'invoice.id = exception.invoice_id')
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .andWhere("exception.status IN ('open', 'in_review')")
      .getCount();
  }

  private async countInvoicesWithExceptions(supplierId: string, fiscalYear: number): Promise<number> {
    const rows = await this.exceptions
      .createQueryBuilder('exception')
      .innerJoin(Invoice, 'invoice', 'invoice.id = exception.invoice_id')
      .select('COUNT(DISTINCT exception.invoice_id)::int', 'total')
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .getRawOne<{ total: number }>();
    return Number(rows?.total ?? 0);
  }

  private async countDuplicates(supplierId: string, fiscalYear: number): Promise<number> {
    return this.duplicates
      .createQueryBuilder('candidate')
      .innerJoin(Invoice, 'invoice', 'invoice.id = candidate.invoice_id')
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .getCount();
  }

  private async yearTotal(supplierId: string, fiscalYear: number): Promise<number> {
    const row = await this.invoices
      .createQueryBuilder('invoice')
      .select('COALESCE(SUM(invoice.total_amount), 0)', 'total')
      .where('invoice.supplier_id = :supplierId', { supplierId })
      .andWhere('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear })
      .getRawOne<{ total: string }>();
    return round(Number(row?.total ?? 0));
  }
}
