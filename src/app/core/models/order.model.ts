import { AppliedCoupon } from './cart.model';

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customer: CustomerInfo;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  appliedCoupons: AppliedCoupon[];
  tracking?: TrackingInfo;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  image: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  street?: string;
  number?: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface ShippingMethod {
  id: string;
  name: string;
  description: string;
  price: number;
  estimatedDays: { min: number; max: number };
  carrier: string;
}

export interface PaymentMethod {
  type: 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer' | 'wallet';
  provider: string;
  details?: PaymentDetails;
}

export interface PaymentDetails {
  cardLast4?: string;
  cardBrand?: string;
  paypalEmail?: string;
}

export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  currentStatus?: string;
  estimatedDelivery?: Date;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  status: string;
  description: string;
  location?: string;
  timestamp: Date;
}

export interface CheckoutData {
  customer: CustomerInfo;
  shippingAddress: Address;
  billingAddress: Address;
  useSameAddressForBilling: boolean;
  shippingMethod: ShippingMethod;
  paymentMethod: PaymentMethod;
  notes?: string;
  acceptedTerms: boolean;
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
}
