export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageCount: number;
  perUserLimit?: number;
  validFrom: Date;
  validUntil: Date;
  applicableProducts?: string[];
  applicableCategories?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: Coupon;
  errorMessage?: string;
  discountAmount?: number;
}

export interface CreateCouponRequest {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  validFrom: Date;
  validUntil: Date;
  applicableProducts?: string[];
  applicableCategories?: string[];
}
