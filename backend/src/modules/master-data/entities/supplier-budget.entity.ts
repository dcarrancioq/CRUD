import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

/**
 * Presupuesto anual asignado a un proveedor. Cada factura registrada consume
 * presupuesto del ejercicio de su fecha de emision, de modo que el informe de
 * proveedor puede comparar consumido vs budget y alertar antes de agotarlo.
 */
@Entity('supplier_budgets')
@Index(['supplierId', 'fiscalYear'], { unique: true })
export class SupplierBudget {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'fiscal_year' })
  fiscalYear: number;

  @Column('decimal', { name: 'budget_amount', precision: 14, scale: 2, transformer: decimal })
  budgetAmount: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ name: 'category_code', nullable: true })
  categoryCode: string;

  /** Porcentaje de consumo a partir del cual el informe avisa (por defecto 85%). */
  @Column({ name: 'alert_threshold_percent', default: 85 })
  alertThresholdPercent: number;

  @Column({ name: 'owner_email', nullable: true })
  ownerEmail: string;

  @Column({ nullable: true })
  notes: string;
}
