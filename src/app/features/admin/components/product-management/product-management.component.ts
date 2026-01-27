import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-management',
  templateUrl: './product-management.component.html',
  styleUrls: ['./product-management.component.css']
})
export class ProductManagementComponent implements OnInit {
  products: Product[] = [];
  loading = true;
  
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 20;

  searchQuery = '';
  statusFilter = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  selectedProducts: Set<string> = new Set();

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.loading = true;
    const params: any = {
      page: this.currentPage,
      limit: this.itemsPerPage,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    if (this.searchQuery) params.search = this.searchQuery;
    if (this.statusFilter) params.status = this.statusFilter;

    this.adminService.getProducts(params).subscribe({
      next: (response) => {
        this.products = response.data;
        this.totalPages = response.totalPages;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: () => {
        this.notificationService.error('Error al cargar productos');
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadProducts();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.loadProducts();
  }

  createProduct(): void {
    this.router.navigate(['/admin/products/new']);
  }

  editProduct(product: Product): void {
    this.router.navigate(['/admin/products', product.id, 'edit']);
  }

  deleteProduct(product: Product): void {
    if (confirm(`¿Estas seguro de eliminar "${product.name}"?`)) {
      this.adminService.deleteProduct(product.id).subscribe({
        next: () => {
          this.notificationService.success('Producto eliminado');
          this.loadProducts();
        },
        error: () => {
          this.notificationService.error('Error al eliminar producto');
        }
      });
    }
  }

  toggleSelection(productId: string): void {
    if (this.selectedProducts.has(productId)) {
      this.selectedProducts.delete(productId);
    } else {
      this.selectedProducts.add(productId);
    }
  }

  selectAll(): void {
    if (this.selectedProducts.size === this.products.length) {
      this.selectedProducts.clear();
    } else {
      this.products.forEach(p => this.selectedProducts.add(p.id));
    }
  }

  deleteSelected(): void {
    if (this.selectedProducts.size === 0) return;
    
    if (confirm(`¿Estas seguro de eliminar ${this.selectedProducts.size} productos?`)) {
      const ids = Array.from(this.selectedProducts);
      let deleted = 0;
      
      ids.forEach(id => {
        this.adminService.deleteProduct(id).subscribe({
          next: () => {
            deleted++;
            if (deleted === ids.length) {
              this.notificationService.success(`${deleted} productos eliminados`);
              this.selectedProducts.clear();
              this.loadProducts();
            }
          }
        });
      });
    }
  }

  getStockStatus(product: Product): string {
    if (!product.stock) return 'unknown';
    return product.stock.status;
  }

  getStockClass(status: string): string {
    const classes: { [key: string]: string } = {
      'in_stock': 'text-success',
      'low_stock': 'text-warning',
      'out_of_stock': 'text-danger'
    };
    return classes[status] || '';
  }
}
