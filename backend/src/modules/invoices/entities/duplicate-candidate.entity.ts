import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

@Entity('duplicate_candidates')
export class DuplicateCandidate {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.duplicateCandidates, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'candidate_invoice_id' })
  candidateInvoiceId: string;

  @Column({ name: 'candidate_invoice_number' })
  candidateInvoiceNumber: string;

  @Column()
  score: number;

  @Column('simple-array', { name: 'matched_fields', default: '' })
  matchedFields: string[];

  @Column()
  reason: string;
}
