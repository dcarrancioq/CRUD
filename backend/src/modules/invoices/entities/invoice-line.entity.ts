import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity('invoice_lines')
export class InvoiceLine {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'line_number' })
  lineNumber: number;

  @Column({ name: 'item_code', nullable: true })
  itemCode: string;

  @Column()
  description: string;

  @Column('decimal', { precision: 14, scale: 2, transformer: decimal })
  quantity: number;

  @Column()
  uom: string;

  @Column('decimal', { name: 'unit_price', precision: 12, scale: 2, transformer: decimal })
  unitPrice: number;

  @Column('decimal', { name: 'line_total', precision: 14, scale: 2, transformer: decimal })
  lineTotal: number;

  @Column('decimal', { name: 'tax_rate', precision: 5, scale: 2, transformer: decimal })
  taxRate: number;

  @Column({ name: 'category_code', nullable: true })
  categoryCode: string;

  @Column({ name: 'gl_account', nullable: true })
  glAccount: string;

  @Column({ name: 'cost_center', nullable: true })
  costCenter: string;

  @Column({ name: 'purchase_order_line_id', nullable: true })
  purchaseOrderLineId: string;
}
