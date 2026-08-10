import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('spend_categories')
export class SpendCategory {
  @PrimaryColumn()
  code: string;

  @Column()
  name: string;

  @Column({ name: 'parent_code', nullable: true })
  parentCode: string;

  @Column({ default: 2 })
  level: number;

  @Column({ name: 'gl_account' })
  glAccount: string;

  @Column('simple-array', { default: '' })
  keywords: string[];
}
