import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column('jsonb', { default: [] })
  items: CartItem[];

    @Column({ name: 'coupon_code', nullable: true })
    couponCode: string | null;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt: Date;
}

export interface CartItem {
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}
