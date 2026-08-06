import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Sociedad juridica del grupo a la que se imputa el gasto. Una factura puede
 * repartirse entre varias sociedades a traves de sus lineas de imputacion.
 */
@Entity('companies')
export class Company {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ name: 'legal_name' })
  legalName: string;

  @Column({ name: 'tax_id' })
  taxId: string;

  @Column({ default: 'ES' })
  country: string;

  @Column({ default: 'EUR' })
  currency: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'inactive';
}
