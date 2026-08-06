import { AlertSeverity, BudgetStatus } from './supplier-report.model';

export type AnalyticsPeriod = 'month' | 'quarter' | 'year';

export interface AnalyticsFilters {
  fiscalYear: number;
  period: AnalyticsPeriod;
  companyId?: string;
  orgUnitId?: string;
  categoryCode?: string;
  supplierId?: string;
}

export interface AnalyticsFilterLabels {
  company: string;
  orgUnit: string;
  category: string;
  supplier: string;
  period: string;
}

/** Cuadro presupuestario del ambito filtrado. */
export interface AnalyticsBudgetSummary {
  assignedAmount: number;
  consumedAmount: number;
  committedAmount: number;
  availableAmount: number;
  executionPercent: number;
  deviationAmount: number;
  deviationPercent: number;
  forecastYearEndAmount: number;
  forecastDeviationPercent: number;
  previousYearAmount: number;
  yoyVariationPercent?: number;
  invoiceCount: number;
  supplierCount: number;
  blockedAmount: number;
  openPurchaseOrders: number;
  status: BudgetStatus;
  currency: string;
}

export interface AnalyticsPeriodBucket {
  key: string;
  label: string;
  budgetAmount: number;
  consumedAmount: number;
  cumulativeAmount: number;
  budgetCumulativeAmount: number;
  invoiceCount: number;
  executionPercent: number;
  previousYearAmount: number;
  yoyVariationPercent?: number;
}

export interface AnalyticsDimensionRow {
  id: string;
  code: string;
  name: string;
  parentName?: string;
  assignedAmount: number;
  consumedAmount: number;
  committedAmount: number;
  availableAmount: number;
  executionPercent: number;
  deviationAmount: number;
  deviationPercent: number;
  previousYearAmount: number;
  yoyVariationPercent?: number;
  invoiceCount: number;
  supplierCount: number;
  status: BudgetStatus;
}

export interface AnalyticsSupplierRow {
  supplierId: string;
  legalName: string;
  taxId: string;
  awardedAmount: number;
  consumedAmount: number;
  orderCount: number;
  contractCount: number;
  onTimeDeliveryPercent?: number;
  paymentTermsCompliancePercent?: number;
  avgPaymentTermsDeviationDays: number;
  incidents: number;
  openExceptions: number;
  duplicateCandidates: number;
  blockedInvoices: number;
  avgRiskScore: number;
  previousYearAmount: number;
  yoyVariationPercent?: number;
  sharePercent: number;
}

export interface AnalyticsSupplierTrend {
  supplierId: string;
  legalName: string;
  amounts: number[];
}

export interface AnalyticsAlert {
  code: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}

export interface ProcurementAnalyticsReport {
  filters: AnalyticsFilters;
  labels: AnalyticsFilterLabels;
  generatedAt: string;
  summary: AnalyticsBudgetSummary;
  periods: AnalyticsPeriodBucket[];
  byCompany: AnalyticsDimensionRow[];
  byOrgUnit: AnalyticsDimensionRow[];
  byCategory: AnalyticsDimensionRow[];
  suppliers: AnalyticsSupplierRow[];
  supplierTrend: AnalyticsSupplierTrend[];
  alerts: AnalyticsAlert[];
}

/** Sociedades y areas a las que esta asociado un proveedor. */
export interface SupplierDirectoryScope {
  companyId: string;
  companyName: string;
  orgUnits: string[];
  amount: number;
}

export interface SupplierDirectoryContract {
  id: string;
  reference: string;
  categoryCode: string;
  validFrom: string;
  validUntil: string;
  committedAnnualSpend: number;
  currency: string;
  paymentTermsDays: number;
  status: string;
  companies: string[];
  orgUnits: string[];
}

export interface SupplierDirectoryRow {
  supplierId: string;
  taxId: string;
  legalName: string;
  status: string;
  defaultCategoryCode?: string;
  categories: string[];
  riskScore: number;
  paymentTermsDays: number;
  onboardedAt: string;
  contactEmail?: string;
  bankAccountsPendingVerification: number;
  invoiceCount: number;
  consumedAmount: number;
  contractCount: number;
  contracts: SupplierDirectoryContract[];
  companies: SupplierDirectoryScope[];
}
