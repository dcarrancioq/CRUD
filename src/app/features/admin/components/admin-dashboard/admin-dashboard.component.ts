import { Component, OnInit } from '@angular/core';
import { AdminService, DashboardStats, ProductReport } from '../../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  stats?: DashboardStats & { totalCustomers?: number; totalProducts?: number };
  topProducts: ProductReport[] = [];
  recentOrders: any[] = [];
  loading = true;
  
  selectedPeriod: 'week' | 'month' | 'year' = 'month';
  periodOptions: { value: 'week' | 'month' | 'year'; label: string }[] = [
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'year', label: 'Este año' }
  ];

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loading = true;
    
    this.adminService.getDashboardStats(this.selectedPeriod).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.adminService.getTopProducts(5, this.selectedPeriod).subscribe({
      next: (products) => this.topProducts = products
    });

    this.adminService.getOrders({ limit: 5 }).subscribe({
      next: (response) => this.recentOrders = response.data
    });
  }

  onPeriodChange(): void {
    this.loadDashboardData();
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
}
