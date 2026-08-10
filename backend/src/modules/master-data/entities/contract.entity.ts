import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { ContractPrice } from './contract-price.entity';
import { ContractScope } from './contract-scope.entity';

@Entity('contracts')
export class Contract {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ unique: true })
  reference: string;

  @Column({ name: 'category_code' })
  categoryCode: string;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'date' })
  validUntil: Date;

  @Column('decimal', { name: 'committed_annual_spend', precision: 14, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  committedAnnualSpend: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ name: 'payment_terms_days', default: 30 })
  paymentTermsDays: number;

  @Column('decimal', { name: 'early_payment_discount_percent', precision: 5, scale: 2, nullable: true, transformer: { to: (v: number) => v, from: (v: string | null) => (v === null ? null : Number(v)) } })
  earlyPaymentDiscountPercent: number;

  @Column({ name: 'auto_renew', default: false })
  autoRenew: boolean;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'expired' | 'terminated';

  @OneToMany(() => ContractPrice, (price) => price.contract, { cascade: true, eager: true })
  priceList: ContractPrice[];

  /** Sociedades y areas que pueden consumir el contrato. */
  @OneToMany(() => ContractScope, (scope) => scope.contract, { cascade: true, eager: true })
  scopes: ContractScope[];
}
