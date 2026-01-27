import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  createdAt: Date;
  lastOrderAt?: Date;
}

@Component({
  selector: 'app-customer-management',
  templateUrl: './customer-management.component.html',
  styleUrls: ['./customer-management.component.css']
})
export class CustomerManagementComponent implements OnInit {
  customers: Customer[] = [];
  loading = true;
  
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;

  searchQuery = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  selectedCustomer?: Customer;
  customerOrders: any[] = [];
  showDetailModal = false;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.loading = true;
    const params: any = {
      page: this.currentPage,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    if (this.searchQuery) params.search = this.searchQuery;

    this.adminService.getCustomers(params).subscribe({
      next: (response) => {
        this.customers = response.data;
        this.totalPages = response.totalPages;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Error al cargar clientes');
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadCustomers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadCustomers();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.loadCustomers();
  }

  viewCustomer(customer: Customer): void {
    this.selectedCustomer = customer;
    this.loadCustomerDetails(customer.id);
    this.showDetailModal = true;
  }

  loadCustomerDetails(customerId: string): void {
    this.adminService.getCustomerDetails(customerId).subscribe({
      next: (details) => {
        this.customerOrders = details.orders || [];
      }
    });
  }

  closeModal(): void {
    this.showDetailModal = false;
    this.selectedCustomer = undefined;
    this.customerOrders = [];
  }
}
