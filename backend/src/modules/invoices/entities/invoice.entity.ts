import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { InvoiceAllocation } from './invoice-allocation.entity';
import { InvoiceLine } from './invoice-line.entity';
import { InvoiceException } from './invoice-exception.entity';
import { DuplicateCandidate } from './duplicate-candidate.entity';
import { AuditEvent } from './audit-event.entity';
import { ClassificationMethod, RiskBand, RiskSignal, ThreeWayMatchResult } from '../invoice.types';

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

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity('invoices')
@Index(['supplierId', 'invoiceNumber'])
export class Invoice {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_number' })
  invoiceNumber: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'supplier_name' })
  supplierName: string;

  @Column({ name: 'supplier_tax_id' })
  supplierTaxId: string;

  @Column({ name: 'purchase_order_number', nullable: true })
  purchaseOrderNumber: string;

  @Column({ name: 'contract_reference', nullable: true })
  contractReference: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: Date;

  @Column({ name: 'received_date', type: 'date' })
  receivedDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ default: 'EUR' })
  currency: string;

  @Column('decimal', { name: 'exchange_rate', precision: 12, scale: 6, default: 1, transformer: decimal })
  exchangeRate: number;

  @Column('decimal', { precision: 14, scale: 2, transformer: decimal })
  subtotal: number;

  @Column('decimal', { name: 'tax_rate', precision: 5, scale: 2, transformer: decimal })
  taxRate: number;

  @Column('decimal', { name: 'tax_amount', precision: 14, scale: 2, transformer: decimal })
  taxAmount: number;

  @Column('decimal', { name: 'total_amount', precision: 14, scale: 2, transformer: decimal })
  totalAmount: number;

  @Column({ name: 'payment_terms_days', default: 30 })
  paymentTermsDays: number;

  @Column({ name: 'payment_method', type: 'varchar', default: 'transfer' })
  paymentMethod: 'transfer' | 'direct_debit' | 'card' | 'check';

  @Column({ name: 'bank_account_iban' })
  bankAccountIban: string;

  @Column({ name: 'bank_account_holder', nullable: true })
  bankAccountHolder: string;

  /** CECO principal (el de mayor peso del reparto analitico). */
  @Column({ name: 'cost_center' })
  costCenter: string;

  /** Sociedad y area principales del reparto, para filtrar sin recorrer el reparto. */
  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'org_unit_id', nullable: true })
  orgUnitId: string;

  @Column({ name: 'requester_email', nullable: true })
  requesterEmail: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'manual' })
  source: InvoiceSource;

  @Column({ type: 'varchar', default: 'registered' })
  status: InvoiceStatus;

  @Column({ name: 'category_code' })
  categoryCode: string;

  @Column({ name: 'category_name' })
  categoryName: string;

  @Column({ name: 'gl_account' })
  glAccount: string;

  @Column({ name: 'classification_confidence' })
  classificationConfidence: number;

  @Column({ name: 'classification_method', type: 'varchar' })
  classificationMethod: ClassificationMethod;

  @Column('simple-array', { name: 'classification_keywords', default: '' })
  classificationKeywords: string[];

  @Column({ name: 'risk_score', default: 0 })
  riskScore: number;

  @Column({ name: 'risk_band', type: 'varchar', default: 'low' })
  riskBand: RiskBand;

  @Column({ name: 'release_recommendation', type: 'varchar', default: 'auto_release' })
  releaseRecommendation: 'auto_release' | 'manual_review' | 'block';

  @Column({ name: 'risk_signals', type: 'jsonb', default: () => "'[]'" })
  riskSignals: RiskSignal[];

  @Column({ name: 'match_result', type: 'jsonb', nullable: true })
  matchResult: ThreeWayMatchResult | null;

  @Column({ name: 'risk_evaluated_at', type: 'timestamptz' })
  riskEvaluatedAt: Date;

  @OneToMany(() => InvoiceLine, (line) => line.invoice, { cascade: true, eager: true })
  lines: InvoiceLine[];

  @OneToMany(() => InvoiceAllocation, (allocation) => allocation.invoice, {
    cascade: true,
    eager: true,
  })
  allocations: InvoiceAllocation[];

  @OneToMany(() => InvoiceException, (exception) => exception.invoice, { cascade: true, eager: true })
  exceptions: InvoiceException[];

  @OneToMany(() => DuplicateCandidate, (candidate) => candidate.invoice, { cascade: true, eager: true })
  duplicateCandidates: DuplicateCandidate[];

  @OneToMany(() => AuditEvent, (event) => event.invoice, { cascade: true, eager: true })
  auditTrail: AuditEvent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
