import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

/**
 * Area / departamento organizativo dentro de una sociedad. Es la dimension
 * intermedia del informe analitico (sociedad > area > centro de coste).
 */
@Entity('org_units')
@Index(['companyId', 'code'], { unique: true })
export class OrgUnit {
  @PrimaryColumn()
  id: string;

  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @Column({ type: 'varchar', default: 'area' })
  type: 'area' | 'department';

  @Column({ name: 'manager_email', nullable: true })
  managerEmail: string;

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'inactive';
}
