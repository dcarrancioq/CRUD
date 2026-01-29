import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  description: string;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
  })
  discountType: DiscountType;

  @Column('decimal', { name: 'discount_value', precision: 10, scale: 2 })
  discountValue: number;

  @Column('decimal', { name: 'min_purchase', precision: 10, scale: 2, default: 0 })
  minPurchase: number;

  @Column('decimal', { name: 'max_discount', precision: 10, scale: 2, nullable: true })
  maxDiscount: number;

  @Column({ name: 'usage_limit', nullable: true })
  usageLimit: number;

  @Column({ name: 'usage_count', default: 0 })
  usageCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'starts_at' })
  startsAt: Date;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
