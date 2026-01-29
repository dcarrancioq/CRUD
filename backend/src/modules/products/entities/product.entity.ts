import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Review } from './review.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

export enum StockStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
}

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  sku: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column('text')
  description: string;

  @Column({ name: 'short_description' })
  shortDescription: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('decimal', { name: 'compare_at_price', precision: 10, scale: 2, nullable: true })
  compareAtPrice: number;

  @Column('decimal', { name: 'cost_price', precision: 10, scale: 2, nullable: true })
  costPrice: number;

  @Column({ default: 'EUR' })
  currency: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  weight: number;

  @Column('jsonb', { default: [] })
  images: ProductImage[];

  @ManyToOne(() => Category, (category) => category.products)
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id' })
  categoryId: string;

  @Column('simple-array', { default: '' })
  tags: string[];

  @Column('jsonb', { nullable: true })
  variants: ProductVariant[];

  @Column('jsonb', { default: [] })
  attributes: ProductAttribute[];

  @Column('jsonb', { default: {} })
  stock: StockInfo;

  @Column('jsonb', { default: {} })
  seo: SEOInfo;

  @Column('jsonb', { default: { average: 0, count: 0, distribution: {} } })
  ratings: RatingsSummary;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Review, (review) => review.product)
  reviews: Review[];
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  position: number;
  isMain: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  attributes: { name: string; value: string }[];
  image?: ProductImage;
}

export interface ProductAttribute {
  name: string;
  value: string;
  displayOrder: number;
}

export interface StockInfo {
  quantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: StockStatus;
}

export interface SEOInfo {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
}

export interface RatingsSummary {
  average: number;
  count: number;
  distribution: { [key: number]: number };
}
