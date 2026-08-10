import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Centro de coste (CECO). Pertenece a una sociedad y a un area, de modo que al
 * imputar una factura a un CECO quedan determinadas las tres dimensiones del
 * informe analitico.
 */
@Entity('cost_centers')
export class CostCenter {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ name: 'org_unit_id' })
  orgUnitId: string;

  @Column({ name: 'gl_account', nullable: true })
  glAccount: string;

  @Column({ name: 'owner_email', nullable: true })
  ownerEmail: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'inactive';
}
