import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('audit_events')
export class AuditEvent {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.auditTrail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column()
  action: string;

  @Column()
  actor: string;

  @Column({ type: 'timestamptz' })
  at: Date;

  @Column({ nullable: true })
  detail: string;

  @Column({ name: 'previous_value', nullable: true })
  previousValue: string;

  @Column({ name: 'new_value', nullable: true })
  newValue: string;
}
