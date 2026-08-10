import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { ExceptionSeverity, RuleCode, ToleranceUnit } from '../../master-data/entities/tolerance-rule.entity';

export type ExceptionStatus = 'open' | 'in_review' | 'resolved' | 'false_positive' | 'escalated';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity('invoice_exceptions')
export class InvoiceException {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.exceptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'rule_code', type: 'varchar' })
  ruleCode: RuleCode;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'varchar' })
  severity: ExceptionSeverity;

  @Column({ type: 'varchar', default: 'open' })
  status: ExceptionStatus;

  @Column('decimal', { name: 'observed_value', precision: 14, scale: 2, transformer: decimal })
  observedValue: number;

  @Column('decimal', { name: 'tolerance_value', precision: 14, scale: 2, transformer: decimal })
  toleranceValue: number;

  @Column({ name: 'tolerance_unit', type: 'varchar' })
  toleranceUnit: ToleranceUnit;

  @Column({ name: 'blocks_payment', default: false })
  blocksPayment: boolean;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @Column({ name: 'assigned_to', nullable: true })
  assignedTo: string;

  @Column({ name: 'resolution_note', nullable: true })
  resolutionNote?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'devin_session_id', nullable: true })
  devinSessionId: string;

  @Column({ name: 'related_invoice_id', nullable: true })
  relatedInvoiceId: string;
}
