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

  @Column({ name: 'company_id', nullable: true })
  companyId: string;

  @Column({ name: 'org_unit_id', nullable: true })
  orgUnitId: string;

  @Column({ name: 'category_code', nullable: true })
  categoryCode: string;

  /** Fecha comprometida de entrega, para medir cumplimiento de plazos. */
  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate: Date;

  @Column({ name: 'delivered_at', type: 'date', nullable: true })
  deliveredAt: Date;

  @Column('decimal', { name: 'approved_amount', precision: 14, scale: 2, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  approvedAmount: number;

  @Column({ type: 'varchar', default: 'open' })
  status: 'open' | 'partially_received' | 'closed' | 'cancelled';

  @OneToMany(() => PurchaseOrderLine, (line) => line.purchaseOrder, { cascade: true, eager: true })
  lines: PurchaseOrderLine[];
}
