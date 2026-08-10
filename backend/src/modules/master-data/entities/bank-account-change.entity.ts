import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('bank_account_changes')
export class BankAccountChange {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'previous_account_id', nullable: true })
  previousAccountId: string;

  @Column({ name: 'new_account_id' })
  newAccountId: string;

  @Column({ name: 'previous_iban_masked', nullable: true })
  previousIbanMasked: string;

  @Column({ name: 'new_iban_masked' })
  newIbanMasked: string;

  @Column({ name: 'changed_at', type: 'timestamptz' })
  changedAt: Date;

  @Column({ name: 'changed_by' })
  changedBy: string;

  @Column({ name: 'request_channel', type: 'varchar' })
  requestChannel: 'email' | 'portal' | 'phone' | 'erp' | 'invoice_document';

  @Column({ default: false })
  verified: boolean;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date;
}
