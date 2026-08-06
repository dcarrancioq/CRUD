import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

const decimal = { to: (v: number) => v, from: (v: string) => Number(v) };

/**
 * Presupuesto de compras por dimension analitica: ejercicio + sociedad + area +
 * categoria de compra. Se define siempre al grano mas fino (los tres ejes) para
 * que el informe pueda agregarlo por cualquier combinacion de filtros con una
 * simple suma, sin riesgo de contar dos veces el mismo importe.
 */
@Entity('dimension_budgets')
@Index(['fiscalYear', 'companyId', 'orgUnitId', 'categoryCode'], { unique: true })
export class DimensionBudget {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'fiscal_year' })
  fiscalYear: number;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'org_unit_id' })
  orgUnitId: string;

  @Column({ name: 'category_code' })
  categoryCode: string;

  @Column('decimal', { name: 'budget_amount', precision: 14, scale: 2, transformer: decimal })
  budgetAmount: number;

  @Column({ default: 'EUR' })
  currency: string;

  /** Porcentaje de ejecucion a partir del cual el cuadro de mando avisa. */
  @Column({ name: 'alert_threshold_percent', default: 85 })
  alertThresholdPercent: number;

  @Column({ name: 'owner_email', nullable: true })
  ownerEmail: string;
}
