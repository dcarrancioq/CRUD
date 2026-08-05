import { RuleCode } from '../master-data/entities/tolerance-rule.entity';

export type ClassificationMethod =
  | 'rule_keyword'
  | 'supplier_default'
  | 'contract'
  | 'manual'
  | 'model';

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface RiskSignal {
  code: RuleCode;
  weight: number;
  detail: string;
}

export interface SpendClassificationResult {
  categoryCode: string;
  categoryName: string;
  glAccount: string;
  confidence: number;
  method: ClassificationMethod;
  matchedKeywords: string[];
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

export interface DuplicateScore {
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
