import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import { Order, TrackingInfo } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-tracking',
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.css']
})
export class OrderTrackingComponent implements OnInit {
  order?: Order;
  tracking?: TrackingInfo;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    const orderNumber = this.route.snapshot.params['orderNumber'];
    if (orderNumber) {
      this.loadOrderAndTracking(orderNumber);
    }
  }

  loadOrderAndTracking(orderNumber: string): void {
    this.orderService.getOrderByNumber(orderNumber).subscribe({
      next: (order) => {
        this.order = order;
        this.loadTracking(order.id);
      },
      error: () => {
        this.error = 'No se pudo cargar el pedido';
        this.loading = false;
      }
    });
  }

  loadTracking(orderId: string): void {
    this.orderService.getTracking(orderId).subscribe({
      next: (tracking) => {
        this.tracking = tracking;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la informacion de seguimiento';
        this.loading = false;
      }
    });
  }

  getStatusIcon(status: string): string {
    const icons: { [key: string]: string } = {
      'order_placed': 'bag-check',
      'processing': 'gear',
      'shipped': 'truck',
      'in_transit': 'geo-alt',
      'out_for_delivery': 'bicycle',
      'delivered': 'house-check'
    };
    return icons[status] || 'circle';
  }

  isStepCompleted(stepIndex: number): boolean {
    if (!this.tracking?.events) return false;
    return stepIndex < this.tracking.events.length;
  }

  isStepCurrent(stepIndex: number): boolean {
    if (!this.tracking?.events) return false;
    return stepIndex === this.tracking.events.length - 1;
  }
}
