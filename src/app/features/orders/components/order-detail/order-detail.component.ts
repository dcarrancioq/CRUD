import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.component.html',
  styleUrls: ['./order-detail.component.css']
})
export class OrderDetailComponent implements OnInit {
  order?: Order;
  loading = true;
  error = '';
  cancelling = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const orderNumber = this.route.snapshot.params['orderNumber'];
    if (orderNumber) {
      this.loadOrder(orderNumber);
    }
  }

  loadOrder(orderNumber: string): void {
    this.orderService.getOrderByNumber(orderNumber).subscribe({
      next: (order) => {
        this.order = order;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el pedido';
        this.loading = false;
      }
    });
  }

  get canCancel(): boolean {
    return this.order?.status === 'pending' || this.order?.status === 'processing';
  }

  get canTrack(): boolean {
    return this.order?.status === 'shipped';
  }

  cancelOrder(): void {
    if (!this.order || !this.canCancel) return;

    if (confirm('¿Estas seguro de cancelar este pedido?')) {
      this.cancelling = true;
      this.orderService.cancelOrder(this.order.id).subscribe({
        next: () => {
          this.notificationService.success('Pedido cancelado correctamente');
          this.loadOrder(this.order!.orderNumber);
          this.cancelling = false;
        },
        error: () => {
          this.notificationService.error('Error al cancelar el pedido');
          this.cancelling = false;
        }
      });
    }
  }

  trackOrder(): void {
    if (this.order) {
      this.router.navigate(['/orders', this.order.orderNumber, 'tracking']);
    }
  }

  reorder(): void {
    if (!this.order) return;

    this.orderService.reorder(this.order.id).subscribe({
      next: () => {
        this.notificationService.success('Productos agregados al carrito');
        this.router.navigate(['/cart']);
      },
      error: () => {
        this.notificationService.error('Error al agregar productos al carrito');
      }
    });
  }

  downloadInvoice(): void {
    if (!this.order) return;

    this.orderService.downloadInvoice(this.order.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura-${this.order!.orderNumber}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.notificationService.error('Error al descargar la factura');
      }
    });
  }

  getStatusClass(status: string): string {
    const classes: { [key: string]: string } = {
      'pending': 'bg-warning',
      'processing': 'bg-info',
      'shipped': 'bg-primary',
      'delivered': 'bg-success',
      'cancelled': 'bg-danger'
    };
    return classes[status] || 'bg-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'pending': 'Pendiente',
      'processing': 'Procesando',
      'shipped': 'Enviado',
      'delivered': 'Entregado',
      'cancelled': 'Cancelado'
    };
    return labels[status] || status;
  }
}
