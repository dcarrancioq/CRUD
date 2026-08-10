import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

export type AllocationMode = 'amount' | 'percent';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

/**
 * Linea de imputacion analitica de la factura: reparte el importe entre
 * sociedad, area, centro de coste y categoria de compra. Con una sola fila la
 * factura es de un CECO; con varias se reparte por importe o por porcentaje
 * (`mode`), y el importe siempre se persiste calculado para que el informe
 * agregue sin recalcular.
 */
@Entity('invoice_allocations')
export class InvoiceAllocation {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.allocations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'company_name' })
  companyName: string;

  @Column({ name: 'org_unit_id' })
  orgUnitId: string;

  @Column({ name: 'org_unit_name' })
  orgUnitName: string;

  @Column({ name: 'cost_center_code' })
  costCenterCode: string;

  @Column({ name: 'cost_center_name', nullable: true })
  costCenterName: string;

  @Column({ name: 'category_code' })
  categoryCode: string;

  @Column({ name: 'category_name', nullable: true })
  categoryName: string;

  @Column({ type: 'varchar', default: 'percent' })
  mode: AllocationMode;

  @Column('decimal', { precision: 7, scale: 4, transformer: decimal })
  percent: number;

  @Column('decimal', { precision: 14, scale: 2, transformer: decimal })
  amount: number;
}
