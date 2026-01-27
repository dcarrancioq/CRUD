import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../../../core/services/order.service';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-history',
  templateUrl: './order-history.component.html',
  styleUrls: ['./order-history.component.css']
})
export class OrderHistoryComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  error = '';
  
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  statusFilter: string = '';
  statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'processing', label: 'Procesando' },
    { value: 'shipped', label: 'Enviado' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  constructor(
    private orderService: OrderService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    const params: any = { page: this.currentPage };
    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    this.orderService.getOrders(params).subscribe({
      next: (response) => {
        this.orders = response.data;
        this.totalPages = response.totalPages;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: () => {
        this.error = 'Error al cargar los pedidos';
        this.loading = false;
      }
    });
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.loadOrders();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrders();
  }

  viewOrder(order: Order): void {
    this.router.navigate(['/orders', order.orderNumber]);
  }

  trackOrder(order: Order): void {
    this.router.navigate(['/orders', order.orderNumber, 'tracking']);
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
