import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { SupplierBankAccount } from './supplier-bank-account.entity';

export type SupplierStatus = 'active' | 'blocked' | 'pending_validation' | 'inactive';

@Entity('suppliers')
export class Supplier {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'tax_id', unique: true })
  taxId: string;

  @Column({ name: 'legal_name' })
  legalName: string;

  @Column({ name: 'trade_name', nullable: true })
  tradeName: string;

  @Column({ default: 'ES' })
  country: string;

  @Column({ type: 'varchar', default: 'active' })
  status: SupplierStatus;

  @Column({ name: 'default_category_code', nullable: true })
  defaultCategoryCode: string;

  @Column({ name: 'payment_terms_days', default: 30 })
  paymentTermsDays: number;

  @Column({ name: 'onboarded_at', type: 'date' })
  onboardedAt: Date;

  @Column({ name: 'risk_score', default: 0 })
  riskScore: number;

  @Column({ name: 'contact_email', nullable: true })
  contactEmail: string;

  @OneToMany(() => SupplierBankAccount, (account) => account.supplier, {
    cascade: true,
    eager: true,
  })
  bankAccounts: SupplierBankAccount[];
}
