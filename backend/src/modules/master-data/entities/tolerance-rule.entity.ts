import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ToleranceProfile } from './tolerance-profile.entity';

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

export type ExceptionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ToleranceUnit = 'amount' | 'percent' | 'days' | 'count';

@Entity('tolerance_rules')
export class ToleranceRule {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'profile_id' })
  profileId: string;

  @ManyToOne(() => ToleranceProfile, (profile) => profile.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile: ToleranceProfile;

  @Column({ name: 'rule_code', type: 'varchar' })
  ruleCode: RuleCode;

  @Column({ default: true })
  enabled: boolean;

  @Column('decimal', { precision: 14, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  threshold: number;

  @Column({ type: 'varchar' })
  unit: ToleranceUnit;

  @Column({ type: 'varchar' })
  severity: ExceptionSeverity;

  @Column({ name: 'blocks_payment', default: false })
  blocksPayment: boolean;

  @Column({ name: 'scope_category_code', nullable: true })
  scopeCategoryCode: string;

  @Column({ name: 'scope_supplier_id', nullable: true })
  scopeSupplierId: string;
}
