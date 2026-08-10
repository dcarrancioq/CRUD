export interface CreateSupplierBankAccountRequest {
  iban: string;
  bic?: string;
  holderName: string;
  verificationChannel?: 'callback' | 'portal' | 'certificate' | 'none';
}

export interface CreateSupplierBudgetRequest {
  fiscalYear: number;
  budgetAmount: number;
  currency?: string;
  alertThresholdPercent?: number;
  ownerEmail?: string;
}

/** Alta de proveedor en el maestro desde la pantalla de compras. */
export interface CreateSupplierRequest {
  taxId: string;
  legalName: string;
  tradeName?: string;
  country?: string;
  status?: 'active' | 'blocked' | 'pending_validation' | 'inactive';
  defaultCategoryCode?: string;
  paymentTermsDays?: number;
  contactEmail?: string;
  riskScore?: number;
  bankAccount?: CreateSupplierBankAccountRequest;
  budget?: CreateSupplierBudgetRequest;
}
