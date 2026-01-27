import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  Order, 
  OrderQueryParams, 
  CheckoutData,
  ShippingMethod,
  TrackingInfo
} from '../models/order.model';
import { PaginatedResponse } from '../models/product.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly API_URL = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  getOrders(params: OrderQueryParams = {}): Observable<PaginatedResponse<Order>> {
    let httpParams = new HttpParams();
    
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.startDate) httpParams = httpParams.set('startDate', params.startDate.toISOString());
    if (params.endDate) httpParams = httpParams.set('endDate', params.endDate.toISOString());
    if (params.customerId) httpParams = httpParams.set('customerId', params.customerId);

    return this.http.get<PaginatedResponse<Order>>(this.API_URL, { params: httpParams });
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.API_URL}/${id}`);
  }

  getOrderByNumber(orderNumber: string): Observable<Order> {
    return this.http.get<Order>(`${this.API_URL}/number/${orderNumber}`);
  }

  createOrder(checkoutData: CheckoutData): Observable<Order> {
    return this.http.post<Order>(this.API_URL, checkoutData);
  }

  cancelOrder(orderId: string, reason?: string): Observable<Order> {
    return this.http.post<Order>(`${this.API_URL}/${orderId}/cancel`, { reason });
  }

  getShippingMethods(address: { country: string; postalCode: string }): Observable<ShippingMethod[]> {
    const params = new HttpParams()
      .set('country', address.country)
      .set('postalCode', address.postalCode);
    return this.http.get<ShippingMethod[]>(`${environment.apiUrl}/shipping/methods`, { params });
  }

  calculateShipping(shippingMethodId: string, address: { country: string; postalCode: string }): Observable<{ cost: number; estimatedDays: { min: number; max: number } }> {
    return this.http.post<{ cost: number; estimatedDays: { min: number; max: number } }>(
      `${environment.apiUrl}/shipping/calculate`,
      { shippingMethodId, address }
    );
  }

  getTracking(orderId: string): Observable<TrackingInfo> {
    return this.http.get<TrackingInfo>(`${this.API_URL}/${orderId}/tracking`);
  }

  requestReturn(orderId: string, items: { itemId: string; quantity: number; reason: string }[]): Observable<{ returnId: string; message: string }> {
    return this.http.post<{ returnId: string; message: string }>(
      `${this.API_URL}/${orderId}/return`,
      { items }
    );
  }

  downloadInvoice(orderId: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${orderId}/invoice`, {
      responseType: 'blob'
    });
  }

  reorder(orderId: string): Observable<{ cartId: string; message: string }> {
    return this.http.post<{ cartId: string; message: string }>(
      `${this.API_URL}/${orderId}/reorder`,
      {}
    );
  }
}
