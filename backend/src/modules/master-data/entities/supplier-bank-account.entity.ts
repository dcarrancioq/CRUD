import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from './supplier.entity';

export type BankAccountStatus = 'verified' | 'pending_verification' | 'rejected' | 'archived';

@Entity('supplier_bank_accounts')
export class SupplierBankAccount {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.bankAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column()
  iban: string;

  @Column({ nullable: true })
  bic: string;

  @Column({ name: 'holder_name' })
  holderName: string;

  @Column({ type: 'varchar', default: 'pending_verification' })
  status: BankAccountStatus;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ name: 'registered_at', type: 'date' })
  registeredAt: Date;

  @Column({ name: 'verified_at', type: 'date', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'verified_by', nullable: true })
  verifiedBy: string;

  @Column({ name: 'verification_channel', type: 'varchar', nullable: true })
  verificationChannel: 'callback' | 'portal' | 'certificate' | 'none';
}
