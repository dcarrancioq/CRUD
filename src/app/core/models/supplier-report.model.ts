export type BudgetStatus = 'no_budget' | 'on_track' | 'warning' | 'exceeded';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SupplierBudget {
  id: string;
  supplierId: string;
  fiscalYear: number;
  budgetAmount: number;
  currency: string;
  categoryCode?: string;
  alertThresholdPercent: number;
  ownerEmail?: string;
  notes?: string;
}

export interface SupplierReportConsumption {
  invoiceCount: number;
  consumedAmount: number;
  blockedAmount: number;
  consumedPercent: number;
  remainingAmount: number;
  deviationAmount: number;
  deviationPercent: number;
  forecastYearEndAmount: number;
  forecastDeviationPercent: number;
  status: BudgetStatus;
}

export interface SupplierReportMonth {
  month: number;
  label: string;
  invoiceCount: number;
  amount: number;
  cumulativeAmount: number;
  budgetCumulativeAmount: number;
  deviationPercent: number;
}

export interface SupplierReportCategory {
  categoryCode: string;
  categoryName: string;
  invoiceCount: number;
  amount: number;
  sharePercent: number;
}

export interface SupplierReportTracking {
  avgInvoiceAmount: number;
  maxInvoiceAmount: number;
  avgPaymentTermsDays: number;
  contractPaymentTermsDays?: number;
  avgRiskScore: number;
  exceptionRatePercent: number;
  openExceptions: number;
  blockedInvoices: number;
  invoicesWithoutPurchaseOrder: number;
  duplicateCandidates: number;
  bankAccountChanges: number;
  lastInvoiceDate?: string;
  previousYearAmount: number;
  yoyVariationPercent?: number;
}

export interface SupplierReportDeviation {
  code: string;
  label: string;
  value: number;
  reference: number;
  deviationPercent: number;
  comment: string;
}

export interface SupplierReportAlert {
  code: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}

export interface SupplierReportInvoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  status: string;
  riskScore: number;
  categoryName: string;
  openExceptions: number;
}

export interface SupplierReport {
  supplier: {
    id: string;
    taxId: string;
    legalName: string;
    status: string;
    onboardedAt: string;
    paymentTermsDays: number;
    riskScore: number;
    contactEmail?: string;
  };
  fiscalYear: number;
  generatedAt: string;
  budget?: {
    amount: number;
    currency: string;
    alertThresholdPercent: number;
    ownerEmail?: string;
    notes?: string;
  };
  consumption: SupplierReportConsumption;
  monthly: SupplierReportMonth[];
  categories: SupplierReportCategory[];
  tracking: SupplierReportTracking;
  deviations: SupplierReportDeviation[];
  alerts: SupplierReportAlert[];
  invoices: SupplierReportInvoice[];
}
