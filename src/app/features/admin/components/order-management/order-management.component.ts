import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Order } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-management',
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.css']
})
export class OrderManagementComponent implements OnInit {
  orders: Order[] = [];
  loading = true;
  
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  statusFilter = '';
  dateFrom = '';
  dateTo = '';

  statusOptions = [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendiente' },
    { value: 'processing', label: 'Procesando' },
    { value: 'shipped', label: 'Enviado' },
    { value: 'delivered', label: 'Entregado' },
    { value: 'cancelled', label: 'Cancelado' }
  ];

  selectedOrder?: Order;
  showDetailModal = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  loadOrders(): void {
    this.loading = true;
    const params: any = { page: this.currentPage };
    
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.dateFrom) params.dateFrom = this.dateFrom;
    if (this.dateTo) params.dateTo = this.dateTo;

    this.adminService.getOrders(params).subscribe({
      next: (response) => {
        this.orders = response.data;
        this.totalPages = response.totalPages;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Error al cargar pedidos');
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadOrders();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrders();
  }

  viewOrder(order: Order): void {
    this.selectedOrder = order;
    this.showDetailModal = true;
  }

  closeModal(): void {
    this.showDetailModal = false;
    this.selectedOrder = undefined;
  }

  updateStatus(order: Order, newStatus: string): void {
    this.adminService.updateOrderStatus(order.id, newStatus).subscribe({
      next: () => {
        this.notificationService.success('Estado actualizado');
        order.status = newStatus;
      },
      error: () => {
        this.notificationService.error('Error al actualizar estado');
      }
    });
  }

  exportOrders(): void {
    const params: any = {};
    if (this.statusFilter) params.status = this.statusFilter;
    if (this.dateFrom) params.dateFrom = this.dateFrom;
    if (this.dateTo) params.dateTo = this.dateTo;

    this.adminService.exportOrders(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedidos-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.notificationService.error('Error al exportar pedidos');
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
