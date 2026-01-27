export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  price: number;
  compareAtPrice?: number;
  costPrice?: number;
  cost?: number;
  weight?: number;
  currency: string;
  images: ProductImage[];
  category: Category;
  subcategory?: Category;
  tags: string[];
  variants?: ProductVariant[];
  attributes: ProductAttribute[];
  stock: StockInfo;
  seo: SEOInfo;
  ratings: RatingsSummary;
  status: 'active' | 'draft' | 'archived';
  createdAt: Date;
  updatedAt: Date;
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentId?: string;
}

export interface StockInfo {
  quantity: number;
  lowStockThreshold: number;
  trackInventory: boolean;
  allowBackorder: boolean;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
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

export interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  createdAt: Date;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'name' | 'createdAt' | 'rating';
  sortOrder?: 'asc' | 'desc';
  search?: string;
  inStock?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
