import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { DuplicateCandidate } from '../invoices/entities/duplicate-candidate.entity';
import { InvoiceAllocation } from '../invoices/entities/invoice-allocation.entity';
import { InvoiceException } from '../invoices/entities/invoice-exception.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { formatDate, round } from '../invoices/invoice.utils';
import { Company } from '../master-data/entities/company.entity';
import { Contract } from '../master-data/entities/contract.entity';
import { DimensionBudget } from '../master-data/entities/dimension-budget.entity';
import { OrgUnit } from '../master-data/entities/org-unit.entity';
import { PurchaseOrder } from '../master-data/entities/purchase-order.entity';
import { SpendCategory } from '../master-data/entities/spend-category.entity';
import { Supplier } from '../master-data/entities/supplier.entity';
import { SupplierBudget } from '../master-data/entities/supplier-budget.entity';
import {
  AnalyticsAlert,
  AnalyticsBudgetSummary,
  AnalyticsDimensionRow,
  AnalyticsFilters,
  AnalyticsPeriodBucket,
  AnalyticsSupplierRow,
  AnalyticsSupplierTrend,
  ProcurementAnalyticsReport,
  SupplierDirectoryContract,
  SupplierDirectoryRow,
  SupplierDirectoryScope,
} from './analytics.types';
import { BudgetStatus } from './report.types';

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

/** Facturas que no consumen presupuesto (anuladas). */
const EXCLUDED_STATUSES = "('rejected')";

interface DimensionAggregate {
  id: string;
  name: string;
  amount: number;
  invoiceCount: number;
  supplierCount: number;
}

/** Compromiso pendiente de un pedido abierto, con sus dimensiones de imputacion. */
interface CommitmentRow {
  companyId: string;
  orgUnitId: string;
  categoryCode: string;
  remaining: number;
}

interface SupplierAggregate {
  supplierId: string;
  amount: number;
  invoiceCount: number;
  riskSum: number;
  blockedInvoices: number;
  paymentTermsDeviationSum: number;
  compliantInvoices: number;
}

/**
 * Cuadro de mando analitico de compras: agrega el gasto por las tres dimensiones
 * (sociedad, area y categoria) usando el reparto analitico de cada factura, lo
 * compara con el presupuesto asignado y los compromisos de pedidos abiertos, y
 * calcula desviaciones, variacion interanual e indicadores de proveedor.
 */
@Injectable()
export class ProcurementAnalyticsService {
  constructor(
    @InjectRepository(Invoice) private readonly invoices: Repository<Invoice>,
    @InjectRepository(InvoiceAllocation) private readonly allocations: Repository<InvoiceAllocation>,
    @InjectRepository(InvoiceException) private readonly exceptions: Repository<InvoiceException>,
    @InjectRepository(DuplicateCandidate) private readonly duplicates: Repository<DuplicateCandidate>,
    @InjectRepository(PurchaseOrder) private readonly purchaseOrders: Repository<PurchaseOrder>,
    @InjectRepository(Contract) private readonly contracts: Repository<Contract>,
    @InjectRepository(Company) private readonly companies: Repository<Company>,
    @InjectRepository(OrgUnit) private readonly orgUnits: Repository<OrgUnit>,
    @InjectRepository(SpendCategory) private readonly categories: Repository<SpendCategory>,
    @InjectRepository(Supplier) private readonly suppliers: Repository<Supplier>,
    @InjectRepository(DimensionBudget) private readonly dimensionBudgets: Repository<DimensionBudget>,
    @InjectRepository(SupplierBudget) private readonly supplierBudgets: Repository<SupplierBudget>,
  ) {}

  async report(filters: AnalyticsFilters): Promise<ProcurementAnalyticsReport> {
    const [companies, orgUnits, categories, suppliers] = await Promise.all([
      this.companies.find(),
      this.orgUnits.find(),
      this.categories.find(),
      this.suppliers.find(),
    ]);
    const companyNames = new Map(companies.map((company) => [company.id, company.legalName]));
    const orgUnitNames = new Map(orgUnits.map((unit) => [unit.id, unit.name]));
    const orgUnitCompany = new Map(orgUnits.map((unit) => [unit.id, unit.companyId]));
    const categoryNames = new Map(categories.map((category) => [category.code, category.name]));
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));

    const assignedAmount = await this.assignedBudget(filters);
    const alertThreshold = await this.alertThreshold(filters);

    const [byCompany, byOrgUnit, byCategory] = await Promise.all([
      this.aggregateBy(filters, 'company_id', 'company_name'),
      this.aggregateBy(filters, 'org_unit_id', 'org_unit_name'),
      this.aggregateBy(filters, 'category_code', 'category_name'),
    ]);

    const consumedAmount = round(byCompany.reduce((total, row) => total + row.amount, 0));
    const invoiceIds = await this.filteredInvoiceIds(filters);
    const previousYearAmount = await this.periodAmount({ ...filters, fiscalYear: filters.fiscalYear - 1 });
    const commitmentRows = await this.openCommitmentRows(filters);
    const commitments = {
      amount: round(commitmentRows.reduce((total, row) => total + row.remaining, 0)),
      orderCount: commitmentRows.length,
    };
    const blockedAmount = await this.blockedAmount(filters);
    const supplierCount = await this.distinctSuppliers(filters);

    const periods = await this.buildPeriods(filters, assignedAmount);
    const supplierRows = await this.buildSupplierRows(filters, consumedAmount, supplierById);
    const supplierTrend = await this.buildSupplierTrend(filters, supplierRows, periods);

    const monthsElapsed = this.monthsElapsed(filters.fiscalYear);
    const forecast = monthsElapsed ? round((consumedAmount / monthsElapsed) * 12) : consumedAmount;
    const executionPercent = assignedAmount ? round((consumedAmount / assignedAmount) * 100) : 0;

    const summary: AnalyticsBudgetSummary = {
      assignedAmount,
      consumedAmount,
      committedAmount: commitments.amount,
      availableAmount: round(assignedAmount - consumedAmount - commitments.amount),
      executionPercent,
      deviationAmount: round(consumedAmount - assignedAmount),
      deviationPercent: assignedAmount
        ? round(((consumedAmount - assignedAmount) / assignedAmount) * 100)
        : 0,
      forecastYearEndAmount: forecast,
      forecastDeviationPercent: assignedAmount
        ? round(((forecast - assignedAmount) / assignedAmount) * 100)
        : 0,
      previousYearAmount,
      yoyVariationPercent: previousYearAmount
        ? round(((consumedAmount - previousYearAmount) / previousYearAmount) * 100)
        : undefined,
      invoiceCount: invoiceIds.length,
      supplierCount,
      blockedAmount,
      openPurchaseOrders: commitments.orderCount,
      status: this.budgetStatus(assignedAmount, executionPercent, alertThreshold),
      currency: 'EUR',
    };

    const budgetsByCompany = await this.budgetsBy(filters, 'company_id');
    const budgetsByOrgUnit = await this.budgetsBy(filters, 'org_unit_id');
    const budgetsByCategory = await this.budgetsBy(filters, 'category_code');
    const previousByCompany = await this.aggregateBy(
      { ...filters, fiscalYear: filters.fiscalYear - 1 },
      'company_id',
      'company_name',
    );
    const previousByOrgUnit = await this.aggregateBy(
      { ...filters, fiscalYear: filters.fiscalYear - 1 },
      'org_unit_id',
      'org_unit_name',
    );
    const previousByCategory = await this.aggregateBy(
      { ...filters, fiscalYear: filters.fiscalYear - 1 },
      'category_code',
      'category_name',
    );
    const commitmentsByCompany = this.groupCommitments(commitmentRows, 'companyId');
    const commitmentsByOrgUnit = this.groupCommitments(commitmentRows, 'orgUnitId');
    const commitmentsByCategory = this.groupCommitments(commitmentRows, 'categoryCode');

    return {
      filters,
      labels: {
        company: filters.companyId ? companyNames.get(filters.companyId) ?? filters.companyId : 'Todas',
        orgUnit: filters.orgUnitId ? orgUnitNames.get(filters.orgUnitId) ?? filters.orgUnitId : 'Todas',
        category: filters.categoryCode
          ? categoryNames.get(filters.categoryCode) ?? filters.categoryCode
          : 'Todas',
        supplier: filters.supplierId
          ? supplierById.get(filters.supplierId)?.legalName ?? filters.supplierId
          : 'Todos',
        period: this.periodLabel(filters.period),
      },
      generatedAt: new Date().toISOString(),
      summary,
      periods,
      byCompany: this.buildDimensionRows(
        byCompany,
        budgetsByCompany,
        previousByCompany,
        commitmentsByCompany,
        alertThreshold,
        (id) => companyNames.get(id),
      ),
      byOrgUnit: this.buildDimensionRows(
        byOrgUnit,
        budgetsByOrgUnit,
        previousByOrgUnit,
        commitmentsByOrgUnit,
        alertThreshold,
        (id) => orgUnitNames.get(id),
        (id) => companyNames.get(orgUnitCompany.get(id) ?? '') ?? undefined,
      ),
      byCategory: this.buildDimensionRows(
        byCategory,
        budgetsByCategory,
        previousByCategory,
        commitmentsByCategory,
        alertThreshold,
        (id) => categoryNames.get(id),
      ),
      suppliers: supplierRows,
      supplierTrend,
      alerts: this.buildAlerts(summary, supplierRows, alertThreshold),
    };
  }

  /** Listado de proveedores con sus sociedades, areas y contratos asociados. */
  async supplierDirectory(search?: string): Promise<SupplierDirectoryRow[]> {
    const suppliers = await this.suppliers.find({ order: { legalName: 'ASC' } });
    const contracts = await this.contracts.find();
    const companies = await this.companies.find();
    const orgUnits = await this.orgUnits.find();
    const companyNames = new Map(companies.map((company) => [company.id, company.legalName]));
    const orgUnitNames = new Map(orgUnits.map((unit) => [unit.id, unit.name]));

    const scopeRows = await this.allocations
      .createQueryBuilder('alloc')
      .innerJoin(Invoice, 'invoice', 'invoice.id = alloc.invoice_id')
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('alloc.company_id', 'companyId')
      .addSelect('alloc.company_name', 'companyName')
      .addSelect('alloc.org_unit_name', 'orgUnitName')
      .addSelect('alloc.category_code', 'categoryCode')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT invoice.id)::int', 'invoiceCount')
      .groupBy('invoice.supplier_id')
      .addGroupBy('alloc.company_id')
      .addGroupBy('alloc.company_name')
      .addGroupBy('alloc.org_unit_name')
      .addGroupBy('alloc.category_code')
      .getRawMany<{
        supplierId: string;
        companyId: string;
        companyName: string;
        orgUnitName: string;
        categoryCode: string;
        amount: string;
        invoiceCount: number;
      }>();

    const invoiceTotals = await this.invoices
      .createQueryBuilder('invoice')
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COUNT(*)::int', 'invoiceCount')
      .addSelect('COALESCE(SUM(invoice.total_amount), 0)', 'amount')
      .groupBy('invoice.supplier_id')
      .getRawMany<{ supplierId: string; invoiceCount: number; amount: string }>();
    const totalsBySupplier = new Map(
      invoiceTotals.map((row) => [
        row.supplierId,
        { invoiceCount: Number(row.invoiceCount), amount: round(Number(row.amount)) },
      ]),
    );

    const term = (search ?? '').trim().toLowerCase();

    return suppliers
      .map((supplier): SupplierDirectoryRow => {
        const supplierScopes = scopeRows.filter((row) => row.supplierId === supplier.id);
        const byCompany = new Map<string, SupplierDirectoryScope>();
        const categories = new Set<string>();

        for (const row of supplierScopes) {
          categories.add(row.categoryCode);
          const scope = byCompany.get(row.companyId) ?? {
            companyId: row.companyId,
            companyName: row.companyName,
            orgUnits: [],
            amount: 0,
          };
          if (row.orgUnitName && !scope.orgUnits.includes(row.orgUnitName)) {
            scope.orgUnits.push(row.orgUnitName);
          }
          scope.amount = round(scope.amount + Number(row.amount));
          byCompany.set(row.companyId, scope);
        }

        const supplierContracts = contracts
          .filter((contract) => contract.supplierId === supplier.id)
          .map((contract): SupplierDirectoryContract => {
            const scopes = contract.scopes ?? [];
            return {
              id: contract.id,
              reference: contract.reference,
              categoryCode: contract.categoryCode,
              validFrom: formatDate(contract.validFrom),
              validUntil: formatDate(contract.validUntil),
              committedAnnualSpend: contract.committedAnnualSpend,
              currency: contract.currency,
              paymentTermsDays: contract.paymentTermsDays,
              status: contract.status,
              companies: [
                ...new Set(scopes.map((scope) => companyNames.get(scope.companyId) ?? scope.companyId)),
              ],
              orgUnits: [
                ...new Set(
                  scopes
                    .filter((scope) => scope.orgUnitId)
                    .map((scope) => orgUnitNames.get(scope.orgUnitId) ?? scope.orgUnitId),
                ),
              ],
            };
          });

        const totals = totalsBySupplier.get(supplier.id);

        return {
          supplierId: supplier.id,
          taxId: supplier.taxId,
          legalName: supplier.legalName,
          status: supplier.status,
          defaultCategoryCode: supplier.defaultCategoryCode || undefined,
          categories: [...categories].filter(Boolean).sort(),
          riskScore: supplier.riskScore,
          paymentTermsDays: supplier.paymentTermsDays,
          onboardedAt: formatDate(supplier.onboardedAt),
          contactEmail: supplier.contactEmail || undefined,
          bankAccountsPendingVerification: (supplier.bankAccounts ?? []).filter(
            (account) => account.status !== 'verified',
          ).length,
          invoiceCount: totals?.invoiceCount ?? 0,
          consumedAmount: totals?.amount ?? 0,
          contractCount: supplierContracts.length,
          contracts: supplierContracts,
          companies: [...byCompany.values()].sort((a, b) => b.amount - a.amount),
        };
      })
      .filter((row) => {
        if (!term) {
          return true;
        }
        const haystack = [
          row.legalName,
          row.taxId,
          row.categories.join(' '),
          row.companies.map((company) => `${company.companyName} ${company.orgUnits.join(' ')}`).join(' '),
          row.contracts.map((contract) => contract.reference).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
  }

  private allocationQuery(filters: AnalyticsFilters): SelectQueryBuilder<InvoiceAllocation> {
    const query = this.allocations
      .createQueryBuilder('alloc')
      .innerJoin(Invoice, 'invoice', 'invoice.id = alloc.invoice_id')
      .where('EXTRACT(YEAR FROM invoice.issue_date) = :fiscalYear', { fiscalYear: filters.fiscalYear })
      .andWhere(`invoice.status NOT IN ${EXCLUDED_STATUSES}`);

    if (filters.companyId) {
      query.andWhere('alloc.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.orgUnitId) {
      query.andWhere('alloc.org_unit_id = :orgUnitId', { orgUnitId: filters.orgUnitId });
    }
    if (filters.categoryCode) {
      query.andWhere('alloc.category_code = :categoryCode', { categoryCode: filters.categoryCode });
    }
    if (filters.supplierId) {
      query.andWhere('invoice.supplier_id = :supplierId', { supplierId: filters.supplierId });
    }
    return query;
  }

  private async aggregateBy(
    filters: AnalyticsFilters,
    idColumn: 'company_id' | 'org_unit_id' | 'category_code',
    nameColumn: 'company_name' | 'org_unit_name' | 'category_name',
  ): Promise<DimensionAggregate[]> {
    const rows = await this.allocationQuery(filters)
      .select(`alloc.${idColumn}`, 'id')
      .addSelect(`MAX(alloc.${nameColumn})`, 'name')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT invoice.id)::int', 'invoiceCount')
      .addSelect('COUNT(DISTINCT invoice.supplier_id)::int', 'supplierCount')
      .groupBy(`alloc.${idColumn}`)
      .getRawMany<{
        id: string;
        name: string;
        amount: string;
        invoiceCount: number;
        supplierCount: number;
      }>();

    return rows
      .map((row) => ({
        id: row.id,
        name: row.name ?? row.id,
        amount: round(Number(row.amount)),
        invoiceCount: Number(row.invoiceCount),
        supplierCount: Number(row.supplierCount),
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  private async periodAmount(filters: AnalyticsFilters): Promise<number> {
    const row = await this.allocationQuery(filters)
      .select('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .getRawOne<{ amount: string }>();
    return round(Number(row?.amount ?? 0));
  }

  private async filteredInvoiceIds(filters: AnalyticsFilters): Promise<string[]> {
    const rows = await this.allocationQuery(filters)
      .select('DISTINCT invoice.id', 'id')
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  private async distinctSuppliers(filters: AnalyticsFilters): Promise<number> {
    const row = await this.allocationQuery(filters)
      .select('COUNT(DISTINCT invoice.supplier_id)::int', 'total')
      .getRawOne<{ total: number }>();
    return Number(row?.total ?? 0);
  }

  private async blockedAmount(filters: AnalyticsFilters): Promise<number> {
    const row = await this.allocationQuery(filters)
      .andWhere("invoice.status = 'blocked'")
      .select('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .getRawOne<{ amount: string }>();
    return round(Number(row?.amount ?? 0));
  }

  /** Presupuesto asignado al ambito filtrado. */
  private async assignedBudget(filters: AnalyticsFilters): Promise<number> {
    if (filters.supplierId) {
      const budgets = await this.supplierBudgets.find({
        where: { supplierId: filters.supplierId, fiscalYear: filters.fiscalYear },
      });
      return round(budgets.reduce((total, budget) => total + budget.budgetAmount, 0));
    }
    const query = this.budgetQuery(filters).select('COALESCE(SUM(budget.budget_amount), 0)', 'amount');
    const row = await query.getRawOne<{ amount: string }>();
    return round(Number(row?.amount ?? 0));
  }

  private async alertThreshold(filters: AnalyticsFilters): Promise<number> {
    const row = await this.budgetQuery(filters)
      .select('ROUND(AVG(budget.alert_threshold_percent))::int', 'threshold')
      .getRawOne<{ threshold: number | null }>();
    return Number(row?.threshold ?? 85);
  }

  private budgetQuery(filters: AnalyticsFilters): SelectQueryBuilder<DimensionBudget> {
    const query = this.dimensionBudgets
      .createQueryBuilder('budget')
      .where('budget.fiscal_year = :fiscalYear', { fiscalYear: filters.fiscalYear });
    if (filters.companyId) {
      query.andWhere('budget.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.orgUnitId) {
      query.andWhere('budget.org_unit_id = :orgUnitId', { orgUnitId: filters.orgUnitId });
    }
    if (filters.categoryCode) {
      query.andWhere('budget.category_code = :categoryCode', { categoryCode: filters.categoryCode });
    }
    return query;
  }

  private async budgetsBy(
    filters: AnalyticsFilters,
    column: 'company_id' | 'org_unit_id' | 'category_code',
  ): Promise<Map<string, number>> {
    if (filters.supplierId) {
      return new Map();
    }
    const rows = await this.budgetQuery(filters)
      .select(`budget.${column}`, 'id')
      .addSelect('COALESCE(SUM(budget.budget_amount), 0)', 'amount')
      .groupBy(`budget.${column}`)
      .getRawMany<{ id: string; amount: string }>();
    return new Map(rows.map((row) => [row.id, round(Number(row.amount))]));
  }

  /**
   * Compromiso pendiente pedido a pedido: lo aprobado menos lo ya facturado contra
   * ese pedido, sin bajar de cero. Se netea por pedido y no sobre el agregado para
   * que un pedido sobrefacturado no anule el compromiso de los demas, y para que el
   * resumen y el desglose por dimension cuadren siempre.
   */
  private async openCommitmentRows(filters: AnalyticsFilters): Promise<CommitmentRow[]> {
    const rows = await this.commitmentQuery(filters)
      .leftJoin(
        Invoice,
        'invoice',
        `invoice.purchase_order_number = po.number AND invoice.status NOT IN ${EXCLUDED_STATUSES}`,
      )
      .select('po.company_id', 'companyId')
      .addSelect('po.org_unit_id', 'orgUnitId')
      .addSelect('po.category_code', 'categoryCode')
      .addSelect(
        'GREATEST(po.approved_amount - COALESCE(SUM(invoice.total_amount), 0), 0)',
        'remaining',
      )
      .groupBy('po.id')
      .getRawMany<{
        companyId: string;
        orgUnitId: string;
        categoryCode: string;
        remaining: string;
      }>();

    return rows.map((row) => ({
      companyId: row.companyId,
      orgUnitId: row.orgUnitId,
      categoryCode: row.categoryCode,
      remaining: round(Number(row.remaining)),
    }));
  }

  private groupCommitments(
    rows: CommitmentRow[],
    key: 'companyId' | 'orgUnitId' | 'categoryCode',
  ): Map<string, number> {
    const grouped = new Map<string, number>();
    rows.forEach((row) => {
      grouped.set(row[key], round((grouped.get(row[key]) ?? 0) + row.remaining));
    });
    return grouped;
  }

  private commitmentQuery(filters: AnalyticsFilters): SelectQueryBuilder<PurchaseOrder> {
    const query = this.purchaseOrders
      .createQueryBuilder('po')
      .where('EXTRACT(YEAR FROM po.issued_at) = :fiscalYear', { fiscalYear: filters.fiscalYear })
      .andWhere("po.status IN ('open', 'partially_received')");
    if (filters.companyId) {
      query.andWhere('po.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.orgUnitId) {
      query.andWhere('po.org_unit_id = :orgUnitId', { orgUnitId: filters.orgUnitId });
    }
    if (filters.categoryCode) {
      query.andWhere('po.category_code = :categoryCode', { categoryCode: filters.categoryCode });
    }
    if (filters.supplierId) {
      query.andWhere('po.supplier_id = :supplierId', { supplierId: filters.supplierId });
    }
    return query;
  }

  private async buildPeriods(
    filters: AnalyticsFilters,
    assignedAmount: number,
  ): Promise<AnalyticsPeriodBucket[]> {
    const current = await this.monthlyAmounts(filters);
    const previous = await this.monthlyAmounts({ ...filters, fiscalYear: filters.fiscalYear - 1 });
    const buckets = this.bucketDefinitions(filters);
    const monthlyBudget = assignedAmount / 12;
    let cumulative = 0;
    let cumulativeBudget = 0;

    return buckets.map((bucket) => {
      const consumedAmount = round(
        bucket.months.reduce((total, month) => total + (current.get(month)?.amount ?? 0), 0),
      );
      const invoiceCount = bucket.months.reduce(
        (total, month) => total + (current.get(month)?.invoiceCount ?? 0),
        0,
      );
      const previousAmount = round(
        bucket.months.reduce((total, month) => total + (previous.get(month)?.amount ?? 0), 0),
      );
      const budgetAmount = round(monthlyBudget * bucket.months.length);
      cumulative = round(cumulative + consumedAmount);
      cumulativeBudget = round(cumulativeBudget + budgetAmount);

      return {
        key: bucket.key,
        label: bucket.label,
        budgetAmount,
        consumedAmount,
        cumulativeAmount: cumulative,
        budgetCumulativeAmount: cumulativeBudget,
        invoiceCount,
        executionPercent: budgetAmount ? round((consumedAmount / budgetAmount) * 100) : 0,
        previousYearAmount: previousAmount,
        yoyVariationPercent: previousAmount
          ? round(((consumedAmount - previousAmount) / previousAmount) * 100)
          : undefined,
      };
    });
  }

  private bucketDefinitions(
    filters: AnalyticsFilters,
  ): { key: string; label: string; months: number[] }[] {
    if (filters.period === 'year') {
      return [
        {
          key: `${filters.fiscalYear}`,
          label: `Ejercicio ${filters.fiscalYear}`,
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        },
      ];
    }
    if (filters.period === 'quarter') {
      return [1, 2, 3, 4].map((quarter) => ({
        key: `${filters.fiscalYear}-T${quarter}`,
        label: `T${quarter} ${filters.fiscalYear}`,
        months: [quarter * 3 - 2, quarter * 3 - 1, quarter * 3],
      }));
    }
    return MONTH_LABELS.map((label, index) => ({
      key: `${filters.fiscalYear}-${String(index + 1).padStart(2, '0')}`,
      label: `${label} ${filters.fiscalYear}`,
      months: [index + 1],
    }));
  }

  private async monthlyAmounts(
    filters: AnalyticsFilters,
  ): Promise<Map<number, { amount: number; invoiceCount: number }>> {
    const rows = await this.allocationQuery(filters)
      .select('EXTRACT(MONTH FROM invoice.issue_date)::int', 'month')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT invoice.id)::int', 'invoiceCount')
      .groupBy('month')
      .getRawMany<{ month: number; amount: string; invoiceCount: number }>();
    return new Map(
      rows.map((row) => [
        Number(row.month),
        { amount: round(Number(row.amount)), invoiceCount: Number(row.invoiceCount) },
      ]),
    );
  }

  private buildDimensionRows(
    aggregates: DimensionAggregate[],
    budgets: Map<string, number>,
    previous: DimensionAggregate[],
    commitments: Map<string, number>,
    alertThreshold: number,
    nameFor: (id: string) => string | undefined,
    parentName?: (id: string) => string | undefined,
  ): AnalyticsDimensionRow[] {
    const previousById = new Map(previous.map((row) => [row.id, row.amount]));
    const ids = new Set<string>([
      ...aggregates.map((row) => row.id),
      ...budgets.keys(),
      ...commitments.keys(),
    ]);

    return [...ids]
      .map((id): AnalyticsDimensionRow => {
        const aggregate = aggregates.find((row) => row.id === id);
        const assignedAmount = budgets.get(id) ?? 0;
        const consumedAmount = aggregate?.amount ?? 0;
        const committedAmount = commitments.get(id) ?? 0;
        const previousYearAmount = previousById.get(id) ?? 0;
        const executionPercent = assignedAmount ? round((consumedAmount / assignedAmount) * 100) : 0;

        return {
          id,
          code: id,
          name: aggregate?.name ?? nameFor(id) ?? id,
          parentName: parentName?.(id),
          assignedAmount,
          consumedAmount,
          committedAmount,
          availableAmount: round(assignedAmount - consumedAmount - committedAmount),
          executionPercent,
          deviationAmount: round(consumedAmount - assignedAmount),
          deviationPercent: assignedAmount
            ? round(((consumedAmount - assignedAmount) / assignedAmount) * 100)
            : 0,
          previousYearAmount,
          yoyVariationPercent: previousYearAmount
            ? round(((consumedAmount - previousYearAmount) / previousYearAmount) * 100)
            : undefined,
          invoiceCount: aggregate?.invoiceCount ?? 0,
          supplierCount: aggregate?.supplierCount ?? 0,
          status: this.budgetStatus(assignedAmount, executionPercent, alertThreshold),
        };
      })
      .sort((a, b) => b.consumedAmount - a.consumedAmount);
  }

  private async buildSupplierRows(
    filters: AnalyticsFilters,
    consumedAmount: number,
    supplierById: Map<string, Supplier>,
  ): Promise<AnalyticsSupplierRow[]> {
    const rows = await this.allocationQuery(filters)
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .addSelect('COUNT(DISTINCT invoice.id)::int', 'invoiceCount')
      .groupBy('invoice.supplier_id')
      .getRawMany<{ supplierId: string; amount: string; invoiceCount: number }>();

    const invoiceMetrics = await this.supplierInvoiceMetrics(filters);
    const previous = await this.allocationQuery({ ...filters, fiscalYear: filters.fiscalYear - 1 })
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .groupBy('invoice.supplier_id')
      .getRawMany<{ supplierId: string; amount: string }>();
    const previousBySupplier = new Map(
      previous.map((row) => [row.supplierId, round(Number(row.amount))]),
    );

    const orders = await this.supplierOrderMetrics(filters);
    const exceptions = await this.supplierExceptionCounts(filters);
    const duplicates = await this.supplierDuplicateCounts(filters);
    const contracts = await this.contracts.find();

    return rows
      .map((row): AnalyticsSupplierRow => {
        const supplier = supplierById.get(row.supplierId);
        const metrics = invoiceMetrics.get(row.supplierId);
        const order = orders.get(row.supplierId);
        const amount = round(Number(row.amount));
        const agreedTerms = supplier?.paymentTermsDays ?? 30;
        const openExceptions = exceptions.get(row.supplierId) ?? 0;
        const duplicateCandidates = duplicates.get(row.supplierId) ?? 0;
        const blockedInvoices = metrics?.blockedInvoices ?? 0;
        const previousYearAmount = previousBySupplier.get(row.supplierId) ?? 0;

        return {
          supplierId: row.supplierId,
          legalName: supplier?.legalName ?? row.supplierId,
          taxId: supplier?.taxId ?? '',
          awardedAmount: order?.approvedAmount ?? 0,
          consumedAmount: amount,
          orderCount: order?.orderCount ?? 0,
          contractCount: contracts.filter((contract) => contract.supplierId === row.supplierId).length,
          onTimeDeliveryPercent: order?.onTimeDeliveryPercent,
          paymentTermsCompliancePercent: metrics?.invoiceCount
            ? round((metrics.compliantInvoices / metrics.invoiceCount) * 100)
            : undefined,
          avgPaymentTermsDeviationDays: metrics?.invoiceCount
            ? round(metrics.paymentTermsDeviationSum / metrics.invoiceCount)
            : 0,
          incidents: openExceptions + duplicateCandidates + blockedInvoices,
          openExceptions,
          duplicateCandidates,
          blockedInvoices,
          avgRiskScore: metrics?.invoiceCount ? round(metrics.riskSum / metrics.invoiceCount) : 0,
          previousYearAmount,
          yoyVariationPercent: previousYearAmount
            ? round(((amount - previousYearAmount) / previousYearAmount) * 100)
            : undefined,
          sharePercent: consumedAmount ? round((amount / consumedAmount) * 100) : 0,
        };
      })
      .filter((row) => row.consumedAmount > 0 || row.awardedAmount > 0)
      .sort((a, b) => b.consumedAmount - a.consumedAmount);
  }

  private async supplierInvoiceMetrics(
    filters: AnalyticsFilters,
  ): Promise<Map<string, SupplierAggregate>> {
    const invoiceIds = await this.filteredInvoiceIds(filters);
    if (!invoiceIds.length) {
      return new Map();
    }

    const rows = await this.invoices
      .createQueryBuilder('invoice')
      .innerJoin(Supplier, 'supplier', 'supplier.id = invoice.supplier_id')
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COUNT(*)::int', 'invoiceCount')
      .addSelect('COALESCE(SUM(invoice.risk_score), 0)::int', 'riskSum')
      .addSelect("COUNT(*) FILTER (WHERE invoice.status = 'blocked')::int", 'blockedInvoices')
      .addSelect(
        'COALESCE(SUM(invoice.payment_terms_days - supplier.payment_terms_days), 0)::int',
        'termsDeviationSum',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE invoice.payment_terms_days <= supplier.payment_terms_days)::int',
        'compliantInvoices',
      )
      .where('invoice.id IN (:...invoiceIds)', { invoiceIds })
      .groupBy('invoice.supplier_id')
      .getRawMany<{
        supplierId: string;
        invoiceCount: number;
        riskSum: number;
        blockedInvoices: number;
        termsDeviationSum: number;
        compliantInvoices: number;
      }>();

    return new Map(
      rows.map((row) => [
        row.supplierId,
        {
          supplierId: row.supplierId,
          amount: 0,
          invoiceCount: Number(row.invoiceCount),
          riskSum: Number(row.riskSum),
          blockedInvoices: Number(row.blockedInvoices),
          paymentTermsDeviationSum: Number(row.termsDeviationSum),
          compliantInvoices: Number(row.compliantInvoices),
        },
      ]),
    );
  }

  private async supplierOrderMetrics(filters: AnalyticsFilters): Promise<
    Map<string, { approvedAmount: number; orderCount: number; onTimeDeliveryPercent?: number }>
  > {
    const query = this.purchaseOrders
      .createQueryBuilder('po')
      .where('EXTRACT(YEAR FROM po.issued_at) = :fiscalYear', { fiscalYear: filters.fiscalYear });
    if (filters.companyId) {
      query.andWhere('po.company_id = :companyId', { companyId: filters.companyId });
    }
    if (filters.orgUnitId) {
      query.andWhere('po.org_unit_id = :orgUnitId', { orgUnitId: filters.orgUnitId });
    }
    if (filters.categoryCode) {
      query.andWhere('po.category_code = :categoryCode', { categoryCode: filters.categoryCode });
    }
    if (filters.supplierId) {
      query.andWhere('po.supplier_id = :supplierId', { supplierId: filters.supplierId });
    }

    const rows = await query
      .select('po.supplier_id', 'supplierId')
      .addSelect('COALESCE(SUM(po.approved_amount), 0)', 'approvedAmount')
      .addSelect('COUNT(*)::int', 'orderCount')
      .addSelect('COUNT(po.delivered_at)::int', 'deliveredCount')
      .addSelect(
        'COUNT(*) FILTER (WHERE po.delivered_at IS NOT NULL AND po.delivered_at <= po.expected_delivery_date)::int',
        'onTimeCount',
      )
      .groupBy('po.supplier_id')
      .getRawMany<{
        supplierId: string;
        approvedAmount: string;
        orderCount: number;
        deliveredCount: number;
        onTimeCount: number;
      }>();

    return new Map(
      rows.map((row) => [
        row.supplierId,
        {
          approvedAmount: round(Number(row.approvedAmount)),
          orderCount: Number(row.orderCount),
          onTimeDeliveryPercent: Number(row.deliveredCount)
            ? round((Number(row.onTimeCount) / Number(row.deliveredCount)) * 100)
            : undefined,
        },
      ]),
    );
  }

  private async supplierExceptionCounts(filters: AnalyticsFilters): Promise<Map<string, number>> {
    const invoiceIds = await this.filteredInvoiceIds(filters);
    if (!invoiceIds.length) {
      return new Map();
    }
    const rows = await this.exceptions
      .createQueryBuilder('exception')
      .innerJoin(Invoice, 'invoice', 'invoice.id = exception.invoice_id')
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COUNT(*)::int', 'total')
      .where('exception.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .andWhere("exception.status IN ('open', 'in_review')")
      .groupBy('invoice.supplier_id')
      .getRawMany<{ supplierId: string; total: number }>();
    return new Map(rows.map((row) => [row.supplierId, Number(row.total)]));
  }

  private async supplierDuplicateCounts(filters: AnalyticsFilters): Promise<Map<string, number>> {
    const invoiceIds = await this.filteredInvoiceIds(filters);
    if (!invoiceIds.length) {
      return new Map();
    }
    const rows = await this.duplicates
      .createQueryBuilder('candidate')
      .innerJoin(Invoice, 'invoice', 'invoice.id = candidate.invoice_id')
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('COUNT(*)::int', 'total')
      .where('candidate.invoice_id IN (:...invoiceIds)', { invoiceIds })
      .groupBy('invoice.supplier_id')
      .getRawMany<{ supplierId: string; total: number }>();
    return new Map(rows.map((row) => [row.supplierId, Number(row.total)]));
  }

  /** Evolucion del gasto de los cinco proveedores con mas consumo, para el grafico. */
  private async buildSupplierTrend(
    filters: AnalyticsFilters,
    suppliers: AnalyticsSupplierRow[],
    periods: AnalyticsPeriodBucket[],
  ): Promise<AnalyticsSupplierTrend[]> {
    const top = suppliers.slice(0, 5);
    if (!top.length) {
      return [];
    }

    const rows = await this.allocationQuery(filters)
      .andWhere('invoice.supplier_id IN (:...ids)', { ids: top.map((row) => row.supplierId) })
      .select('invoice.supplier_id', 'supplierId')
      .addSelect('EXTRACT(MONTH FROM invoice.issue_date)::int', 'month')
      .addSelect('COALESCE(SUM(alloc.amount), 0)', 'amount')
      .groupBy('invoice.supplier_id')
      .addGroupBy('month')
      .getRawMany<{ supplierId: string; month: number; amount: string }>();

    const buckets = this.bucketDefinitions(filters);
    const monthIndex = new Map<number, number>();
    buckets.forEach((bucket, index) => bucket.months.forEach((month) => monthIndex.set(month, index)));

    return top.map((supplier) => {
      const amounts = new Array<number>(periods.length).fill(0);
      for (const row of rows.filter((item) => item.supplierId === supplier.supplierId)) {
        const index = monthIndex.get(Number(row.month));
        if (index !== undefined) {
          amounts[index] = round(amounts[index] + Number(row.amount));
        }
      }
      return { supplierId: supplier.supplierId, legalName: supplier.legalName, amounts };
    });
  }

  private buildAlerts(
    summary: AnalyticsBudgetSummary,
    suppliers: AnalyticsSupplierRow[],
    alertThreshold: number,
  ): AnalyticsAlert[] {
    const alerts: AnalyticsAlert[] = [];

    if (!summary.assignedAmount) {
      alerts.push({
        code: 'BUDGET_MISSING',
        severity: 'warning',
        title: 'Sin presupuesto asignado',
        message:
          'El ambito filtrado no tiene presupuesto: el consumo no se puede controlar contra budget.',
      });
    } else if (summary.executionPercent >= 100) {
      alerts.push({
        code: 'BUDGET_EXCEEDED',
        severity: 'critical',
        title: 'Presupuesto agotado',
        message: `Ejecucion del ${summary.executionPercent}% (${summary.consumedAmount} de ${summary.assignedAmount}).`,
      });
    } else if (summary.executionPercent >= alertThreshold) {
      alerts.push({
        code: 'BUDGET_NEAR_LIMIT',
        severity: 'warning',
        title: 'Presupuesto cerca del limite',
        message: `Ejecucion del ${summary.executionPercent}%, sobre el umbral de aviso del ${alertThreshold}%.`,
      });
    }

    if (summary.availableAmount < 0 && summary.assignedAmount) {
      alerts.push({
        code: 'COMMITMENTS_OVER_BUDGET',
        severity: 'critical',
        title: 'Compromisos por encima del disponible',
        message: `Consumo mas pedidos abiertos superan el presupuesto en ${Math.abs(summary.availableAmount)}.`,
      });
    }

    if (summary.blockedAmount > 0) {
      alerts.push({
        code: 'BLOCKED_PAYMENTS',
        severity: 'critical',
        title: 'Pagos bloqueados',
        message: `${summary.blockedAmount} en facturas con el pago bloqueado por excepciones criticas.`,
      });
    }

    const concentrated = suppliers[0];
    if (concentrated && concentrated.sharePercent >= 40) {
      alerts.push({
        code: 'SUPPLIER_CONCENTRATION',
        severity: 'info',
        title: 'Concentracion de gasto',
        message: `${concentrated.legalName} concentra el ${concentrated.sharePercent}% del gasto del ambito: oportunidad de negociacion o riesgo de dependencia.`,
      });
    }

    const withIncidents = suppliers.filter((supplier) => supplier.incidents > 0).length;
    if (withIncidents) {
      alerts.push({
        code: 'SUPPLIER_INCIDENTS',
        severity: 'warning',
        title: 'Proveedores con incidencias',
        message: `${withIncidents} proveedor(es) acumulan excepciones abiertas, duplicados o facturas bloqueadas.`,
      });
    }

    const lateDelivery = suppliers.filter(
      (supplier) =>
        supplier.onTimeDeliveryPercent !== undefined && supplier.onTimeDeliveryPercent < 80,
    );
    if (lateDelivery.length) {
      alerts.push({
        code: 'DELIVERY_COMPLIANCE',
        severity: 'warning',
        title: 'Cumplimiento de plazos por debajo del objetivo',
        message: `${lateDelivery.length} proveedor(es) entregan a tiempo menos del 80% de los pedidos.`,
      });
    }

    return alerts;
  }

  private budgetStatus(assigned: number, executionPercent: number, threshold: number): BudgetStatus {
    if (!assigned) {
      return 'no_budget';
    }
    if (executionPercent >= 100) {
      return 'exceeded';
    }
    return executionPercent >= threshold ? 'warning' : 'on_track';
  }

  private periodLabel(period: AnalyticsFilters['period']): string {
    return period === 'year' ? 'Anual' : period === 'quarter' ? 'Trimestral' : 'Mensual';
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
}
