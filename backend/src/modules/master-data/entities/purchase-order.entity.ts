import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';
import { PurchaseOrderLine } from './purchase-order-line.entity';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  number: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'contract_id', nullable: true })
  contractId: string;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ name: 'issued_at', type: 'date' })
  issuedAt: Date;

  @Column({ name: 'cost_center' })
  costCenter: string;

  @Column('decimal', { name: 'approved_amount', precision: 14, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  approvedAmount: number;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'partially_received' | 'closed' | 'cancelled';

  @OneToMany(() => PurchaseOrderLine, (line) => line.purchaseOrder, { cascade: true, eager: true })
  lines: PurchaseOrderLine[];
}
