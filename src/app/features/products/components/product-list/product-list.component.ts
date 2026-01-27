import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../../../core/services/product.service';
import { Product, ProductQueryParams, Category, PaginatedResponse } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css']
})
export class ProductListComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  categories: Category[] = [];
  currentCategory?: Category;
  
  loading = false;
  error = '';
  
  currentPage = 1;
  totalPages = 1;
  totalItems = 0;
  itemsPerPage = 12;
  
  sortBy: 'price' | 'name' | 'createdAt' | 'rating' = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';
  
  filters: ProductQueryParams = {};
  viewMode: 'grid' | 'list' = 'grid';
  
  private destroy$ = new Subject<void>();

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['slug']) {
        this.loadCategoryBySlug(params['slug']);
      } else {
        this.currentCategory = undefined;
        this.loadProducts();
      }
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      this.currentPage = queryParams['page'] ? parseInt(queryParams['page'], 10) : 1;
      this.sortBy = queryParams['sortBy'] || 'createdAt';
      this.sortOrder = queryParams['sortOrder'] || 'desc';
      if (queryParams['search']) {
        this.filters.search = queryParams['search'];
      }
      this.loadProducts();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.productService.getCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (categories) => this.categories = categories,
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  loadCategoryBySlug(slug: string): void {
    this.productService.getCategoryBySlug(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: (category) => {
        this.currentCategory = category;
        this.filters.category = category.id;
        this.loadProducts();
      },
      error: (err) => {
        console.error('Error loading category:', err);
        this.router.navigate(['/products']);
      }
    });
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';

    const params: ProductQueryParams = {
      ...this.filters,
      page: this.currentPage,
      limit: this.itemsPerPage,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };

    this.productService.getProducts(params).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: PaginatedResponse<Product>) => {
        this.products = response.data;
        this.totalPages = response.totalPages;
        this.totalItems = response.total;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los productos. Por favor, intente de nuevo.';
        this.loading = false;
        console.error('Error loading products:', err);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updateQueryParams();
  }

  onSortChange(sortBy: string): void {
    if (this.sortBy === sortBy) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = sortBy as any;
      this.sortOrder = 'asc';
    }
    this.currentPage = 1;
    this.updateQueryParams();
  }

  onFilterChange(filters: ProductQueryParams): void {
    this.filters = { ...this.filters, ...filters };
    this.currentPage = 1;
    this.loadProducts();
  }

  onSearch(query: string): void {
    this.filters.search = query;
    this.currentPage = 1;
    this.updateQueryParams();
  }

  clearFilters(): void {
    this.filters = {};
    if (this.currentCategory) {
      this.filters.category = this.currentCategory.id;
    }
    this.currentPage = 1;
    this.loadProducts();
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  private updateQueryParams(): void {
    const queryParams: any = {
      page: this.currentPage > 1 ? this.currentPage : null,
      sortBy: this.sortBy !== 'createdAt' ? this.sortBy : null,
      sortOrder: this.sortOrder !== 'desc' ? this.sortOrder : null,
      search: this.filters.search || null
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }
}
