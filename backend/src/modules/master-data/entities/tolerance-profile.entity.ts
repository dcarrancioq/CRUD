import { Entity, PrimaryColumn, Column, OneToMany, UpdateDateColumn } from 'typeorm';
import { ToleranceRule } from './tolerance-rule.entity';

@Entity('tolerance_profiles')
export class ToleranceProfile {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ default: 'EUR' })
  currency: string;

  @Column('decimal', { name: 'approval_threshold', precision: 14, scale: 2, default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })
  approvalThreshold: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => ToleranceRule, (rule) => rule.profile, { cascade: true, eager: true })
  rules: ToleranceRule[];
}
