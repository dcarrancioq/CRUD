import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, PaginatedResponse, Category } from '../models/product.model';
import { Order, OrderQueryParams } from '../models/order.model';
import { User } from '../models/user.model';
import { Coupon, CreateCouponRequest } from '../models/coupon.model';
import { environment } from '../../../environments/environment';

export interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  pendingOrders: number;
  lowStockProducts: number;
  newCustomers: number;
}

export interface SalesReport {
  period: string;
  sales: number;
  orders: number;
  averageOrderValue: number;
}

export interface ProductReport {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly API_URL = `${environment.apiUrl}/admin`;

  constructor(private http: HttpClient) {}

  getDashboardStats(period: 'day' | 'week' | 'month' | 'year' = 'month'): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.API_URL}/dashboard`, {
      params: new HttpParams().set('period', period)
    });
  }

  getSalesReport(startDate: Date, endDate: Date, groupBy: 'day' | 'week' | 'month' = 'day'): Observable<SalesReport[]> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('groupBy', groupBy);
    return this.http.get<SalesReport[]>(`${this.API_URL}/reports/sales`, { params });
  }

  getTopProducts(limit: number = 10, period: 'week' | 'month' | 'year' = 'month'): Observable<ProductReport[]> {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('period', period);
    return this.http.get<ProductReport[]>(`${this.API_URL}/reports/top-products`, { params });
  }

  getProducts(page: number = 1, limit: number = 20, search?: string): Observable<PaginatedResponse<Product>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<Product>>(`${this.API_URL}/products`, { params });
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.API_URL}/products`, product);
  }

  updateProduct(id: string, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.API_URL}/products/${id}`, product);
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/products/${id}`);
  }

  updateProductStock(id: string, quantity: number): Observable<Product> {
    return this.http.patch<Product>(`${this.API_URL}/products/${id}/stock`, { quantity });
  }

  uploadProductImage(productId: string, file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.http.post<{ url: string }>(`${this.API_URL}/products/${productId}/images`, formData);
  }

  deleteProductImage(productId: string, imageId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/products/${productId}/images/${imageId}`);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.API_URL}/categories`);
  }

  createCategory(category: Partial<Category>): Observable<Category> {
    return this.http.post<Category>(`${this.API_URL}/categories`, category);
  }

  updateCategory(id: string, category: Partial<Category>): Observable<Category> {
    return this.http.put<Category>(`${this.API_URL}/categories/${id}`, category);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/categories/${id}`);
  }

  getOrders(params: OrderQueryParams = {}): Observable<PaginatedResponse<Order>> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate.toISOString());
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate.toISOString());
    if (params.customerId) httpParams = httpParams.set('customerId', params.customerId);
    return this.http.get<PaginatedResponse<Order>>(`${this.API_URL}/orders`, { params: httpParams });
  }

  updateOrderStatus(orderId: string, status: string, notes?: string): Observable<Order> {
    return this.http.patch<Order>(`${this.API_URL}/orders/${orderId}/status`, { status, notes });
  }

  updateTrackingInfo(orderId: string, trackingNumber: string, carrier: string): Observable<Order> {
    return this.http.patch<Order>(`${this.API_URL}/orders/${orderId}/tracking`, { trackingNumber, carrier });
  }

  processRefund(orderId: string, amount: number, reason: string): Observable<{ success: boolean; refundId: string }> {
    return this.http.post<{ success: boolean; refundId: string }>(
      `${this.API_URL}/orders/${orderId}/refund`,
      { amount, reason }
    );
  }

  getCustomers(page: number = 1, limit: number = 20, search?: string): Observable<PaginatedResponse<User>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<User>>(`${this.API_URL}/customers`, { params });
  }

  getCustomerDetails(customerId: string): Observable<User & { orders: Order[]; totalSpent: number }> {
    return this.http.get<User & { orders: Order[]; totalSpent: number }>(
      `${this.API_URL}/customers/${customerId}`
    );
  }

  getCoupons(page: number = 1, limit: number = 20): Observable<PaginatedResponse<Coupon>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<Coupon>>(`${this.API_URL}/coupons`, { params });
  }

  createCoupon(coupon: CreateCouponRequest): Observable<Coupon> {
    return this.http.post<Coupon>(`${this.API_URL}/coupons`, coupon);
  }

  updateCoupon(id: string, coupon: Partial<Coupon>): Observable<Coupon> {
    return this.http.put<Coupon>(`${this.API_URL}/coupons/${id}`, coupon);
  }

  deleteCoupon(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/coupons/${id}`);
  }

  toggleCouponStatus(id: string, isActive: boolean): Observable<Coupon> {
    return this.http.patch<Coupon>(`${this.API_URL}/coupons/${id}/status`, { isActive });
  }

  exportOrders(startDate: Date, endDate: Date, format: 'csv' | 'xlsx' = 'csv'): Observable<Blob> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('format', format);
    return this.http.get(`${this.API_URL}/orders/export`, { params, responseType: 'blob' });
  }

  exportProducts(format: 'csv' | 'xlsx' = 'csv'): Observable<Blob> {
    return this.http.get(`${this.API_URL}/products/export`, {
      params: new HttpParams().set('format', format),
      responseType: 'blob'
    });
  }

  importProducts(file: File): Observable<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ imported: number; errors: string[] }>(`${this.API_URL}/products/import`, formData);
  }
}
