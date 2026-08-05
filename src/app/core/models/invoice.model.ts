export type SupplierStatus = 'active' | 'blocked' | 'pending_validation' | 'inactive';

export interface Supplier {
  id: string;
  taxId: string;
  legalName: string;
  tradeName?: string;
  country: string;
  status: SupplierStatus;
  defaultCategoryCode?: string;
  paymentTermsDays: number;
  onboardedAt: string;
  riskScore: number;
  bankAccounts: SupplierBankAccount[];
  contactEmail?: string;
}

export type BankAccountStatus = 'verified' | 'pending_verification' | 'rejected' | 'archived';

export interface SupplierBankAccount {
  id: string;
  supplierId: string;
  iban: string;
  bic?: string;
  holderName: string;
  status: BankAccountStatus;
  isPrimary: boolean;
  registeredAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationChannel?: 'callback' | 'portal' | 'certificate' | 'none';
}

export interface BankAccountChange {
  id: string;
  supplierId: string;
  previousAccountId?: string;
  newAccountId: string;
  previousIbanMasked?: string;
  newIbanMasked: string;
  changedAt: string;
  changedBy: string;
  requestChannel: 'email' | 'portal' | 'phone' | 'erp' | 'invoice_document';
  verified: boolean;
  verifiedAt?: string;
}

export interface SpendCategory {
  code: string;
  name: string;
  parentCode?: string;
  level: 1 | 2 | 3;
  glAccount: string;
  keywords: string[];
  expectedUnitPriceRange?: { min: number; max: number };
}

export type ClassificationMethod = 'rule_keyword' | 'supplier_default' | 'contract' | 'manual' | 'model';

export interface SpendClassification {
  categoryCode: string;
  categoryName: string;
  glAccount: string;
  confidence: number;
  method: ClassificationMethod;
  matchedKeywords: string[];
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface Contract {
  id: string;
  supplierId: string;
  reference: string;
  categoryCode: string;
  validFrom: string;
  validUntil: string;
  committedAnnualSpend: number;
  currency: string;
  paymentTermsDays: number;
  earlyPaymentDiscountPercent?: number;
  priceList: ContractPrice[];
  autoRenew: boolean;
}

export interface ContractPrice {
  itemCode: string;
  description: string;
  unitPrice: number;
  uom: string;
  maxAnnualQuantity?: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  contractId?: string;
  currency: string;
  issuedAt: string;
  costCenter: string;
  approvedAmount: number;
  status: 'open' | 'partially_received' | 'closed' | 'cancelled';
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  itemCode?: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  categoryCode: string;
  receivedQuantity: number;
  invoicedQuantity: number;
}

export interface GoodsReceipt {
  id: string;
  purchaseOrderId: string;
  receiptNumber: string;
  receivedAt: string;
  lines: GoodsReceiptLine[];
}

export interface GoodsReceiptLine {
  purchaseOrderLineId: string;
  quantity: number;
  acceptedQuantity: number;
}

export type InvoiceStatus =
  | 'draft'
  | 'registered'
  | 'under_review'
  | 'approved'
  | 'blocked'
  | 'scheduled_for_payment'
  | 'paid'
  | 'rejected';

export type InvoiceSource = 'manual' | 'ocr' | 'edi' | 'email' | 'supplier_portal';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  supplierTaxId: string;
  purchaseOrderNumber?: string;
  contractReference?: string;
  issueDate: string;
  receivedDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  paymentTermsDays: number;
  paymentMethod: 'transfer' | 'direct_debit' | 'card' | 'check';
  bankAccountIban: string;
  bankAccountHolder?: string;
  costCenter: string;
  requesterEmail?: string;
  description?: string;
  source: InvoiceSource;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  classification: SpendClassification;
  matchResult?: ThreeWayMatchResult;
  riskAssessment: RiskAssessment;
  exceptions: InvoiceException[];
  duplicateCandidates: DuplicateCandidate[];
  auditTrail: AuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  id: string;
  lineNumber: number;
  itemCode?: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  lineTotal: number;
  taxRate: number;
  categoryCode?: string;
  glAccount?: string;
  costCenter?: string;
  purchaseOrderLineId?: string;
}

export interface ThreeWayMatchResult {
  purchaseOrderNumber?: string;
  goodsReceiptNumber?: string;
  matched: boolean;
  amountVariance: number;
  amountVariancePercent: number;
  quantityVariance: number;
  priceVariancePercent: number;
  unmatchedLineNumbers: number[];
}

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ExceptionStatus = 'open' | 'in_review' | 'resolved' | 'false_positive' | 'escalated';

export type RuleCode =
  | 'DUPLICATE_EXACT'
  | 'DUPLICATE_FUZZY'
  | 'BANK_ACCOUNT_UNKNOWN'
  | 'BANK_ACCOUNT_RECENT_CHANGE'
  | 'PRICE_DEVIATION_CONTRACT'
  | 'PO_AMOUNT_VARIANCE'
  | 'PO_MISSING'
  | 'TOTALS_MISMATCH'
  | 'TAX_MISMATCH'
  | 'THRESHOLD_SPLITTING'
  | 'ROUND_AMOUNT'
  | 'AMOUNT_OUTLIER_HISTORY'
  | 'NEW_SUPPLIER_HIGH_AMOUNT'
  | 'PAYMENT_TERMS_MISMATCH'
  | 'CURRENCY_MISMATCH'
  | 'BACKDATED_INVOICE'
  | 'LOW_CLASSIFICATION_CONFIDENCE';

export interface InvoiceException {
  id: string;
  invoiceId: string;
  ruleCode: RuleCode;
  title: string;
  message: string;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  observedValue: number;
  toleranceValue: number;
  toleranceUnit: 'amount' | 'percent' | 'days' | 'count';
  blocksPayment: boolean;
  detectedAt: string;
  assignedTo?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  devinSessionId?: string;
  relatedInvoiceId?: string;
}

export interface ToleranceRule {
  ruleCode: RuleCode;
  enabled: boolean;
  threshold: number;
  unit: 'amount' | 'percent' | 'days' | 'count';
  severity: ExceptionSeverity;
  blocksPayment: boolean;
  scope?: { categoryCode?: string; supplierId?: string; minInvoiceAmount?: number };
}

export interface ToleranceProfile {
  id: string;
  name: string;
  currency: string;
  approvalThreshold: number;
  rules: ToleranceRule[];
  updatedAt: string;
}

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessment {
  invoiceId: string;
  score: number;
  band: RiskBand;
  signals: RiskSignal[];
  evaluatedAt: string;
  releaseRecommendation: 'auto_release' | 'manual_review' | 'block';
}

export interface RiskSignal {
  code: RuleCode;
  weight: number;
  detail: string;
}

export interface DuplicateCandidate {
  invoiceId: string;
  candidateInvoiceId: string;
  candidateInvoiceNumber: string;
  score: number;
  matchedFields: string[];
  reason: string;
}

export interface ConsolidationOpportunity {
  categoryCode: string;
  categoryName: string;
  supplierIds: string[];
  supplierNames: string[];
  invoiceCount: number;
  annualSpend: number;
  estimatedSavings: number;
  rationale: string;
}

export interface AuditEvent {
  id: string;
  invoiceId: string;
  action: string;
  actor: string;
  at: string;
  detail?: string;
  previousValue?: string;
  newValue?: string;
}

export interface InvoiceComparison {
  left: Invoice;
  right: Invoice;
  fields: InvoiceComparisonField[];
  duplicateScore: number;
  duplicateVerdict: 'likely_duplicate' | 'needs_review' | 'different';
  matchedFields: string[];
  differingFields: string[];
}

export interface InvoiceComparisonField {
  key: string;
  label: string;
  leftValue: string;
  rightValue: string;
  equal: boolean;
  deltaAbsolute?: number;
  deltaPercent?: number;
  weight: number;
  relevance: 'duplicate_signal' | 'fraud_signal' | 'informative';
}

export interface CreateInvoiceRequest {
  invoiceNumber: string;
  supplierId: string;
  purchaseOrderNumber?: string;
  contractReference?: string;
  issueDate: string;
  receivedDate: string;
  dueDate: string;
  currency: string;
  exchangeRate: number;
  taxRate: number;
  paymentTermsDays: number;
  paymentMethod: Invoice['paymentMethod'];
  bankAccountIban: string;
  bankAccountHolder?: string;
  costCenter: string;
  requesterEmail?: string;
  description?: string;
  source: InvoiceSource;
  lines: CreateInvoiceLineRequest[];
  declaredSubtotal?: number;
  declaredTaxAmount?: number;
  declaredTotalAmount?: number;
  manualCategoryCode?: string;
}

export interface CreateInvoiceLineRequest {
  itemCode?: string;
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  taxRate: number;
  categoryCode?: string;
  costCenter?: string;
}
