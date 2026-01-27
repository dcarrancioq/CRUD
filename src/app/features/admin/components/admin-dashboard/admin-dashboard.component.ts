import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../../core/services/admin.service';

interface DashboardStats {
  totalSales: number;
  totalOrders: number;
  totalCustomers: number;
  totalProducts: number;
  pendingOrders: number;
  lowStockProducts: number;
}

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  stats?: DashboardStats;
  topProducts: TopProduct[] = [];
  recentOrders: any[] = [];
  loading = true;
  
  selectedPeriod: string = 'month';
  periodOptions = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
    { value: 'year', label: 'Este ano' }
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

    this.adminService.getTopProducts(this.selectedPeriod, 5).subscribe({
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
