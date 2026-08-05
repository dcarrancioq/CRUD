import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

@Entity('purchase_order_lines')
export class PurchaseOrderLine {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => PurchaseOrder, (order) => order.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

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

  @Column({ name: 'category_code' })
  categoryCode: string;

  @Column('decimal', { name: 'received_quantity', precision: 14, scale: 2, default: 0, transformer: decimal })
  receivedQuantity: number;

  @Column('decimal', { name: 'invoiced_quantity', precision: 14, scale: 2, default: 0, transformer: decimal })
  invoicedQuantity: number;
}
