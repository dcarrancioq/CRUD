import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Category, ProductQueryParams } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-filter',
  templateUrl: './product-filter.component.html',
  styleUrls: ['./product-filter.component.css']
})
export class ProductFilterComponent {
  @Input() categories: Category[] = [];
  @Input() currentCategory?: Category;
  @Output() filterChange = new EventEmitter<ProductQueryParams>();
  @Output() clearFilters = new EventEmitter<void>();

  minPrice?: number;
  maxPrice?: number;
  inStock: boolean = false;
  selectedCategoryId?: string;

  priceRanges = [
    { label: 'Menos de 25€', min: 0, max: 25 },
    { label: '25€ - 50€', min: 25, max: 50 },
    { label: '50€ - 100€', min: 50, max: 100 },
    { label: '100€ - 200€', min: 100, max: 200 },
    { label: 'Mas de 200€', min: 200, max: undefined }
  ];

  applyFilters(): void {
    const filters: ProductQueryParams = {};
    
    if (this.minPrice !== undefined) filters.minPrice = this.minPrice;
    if (this.maxPrice !== undefined) filters.maxPrice = this.maxPrice;
    if (this.inStock) filters.inStock = true;
    if (this.selectedCategoryId) filters.category = this.selectedCategoryId;

    this.filterChange.emit(filters);
  }

  selectPriceRange(range: { min: number; max?: number }): void {
    this.minPrice = range.min;
    this.maxPrice = range.max;
    this.applyFilters();
  }

  selectCategory(categoryId: string): void {
    this.selectedCategoryId = categoryId;
    this.applyFilters();
  }

  toggleInStock(): void {
    this.inStock = !this.inStock;
    this.applyFilters();
  }

  onClearFilters(): void {
    this.minPrice = undefined;
    this.maxPrice = undefined;
    this.inStock = false;
    this.selectedCategoryId = undefined;
    this.clearFilters.emit();
  }

  hasActiveFilters(): boolean {
    return this.minPrice !== undefined || 
           this.maxPrice !== undefined || 
           this.inStock || 
           this.selectedCategoryId !== undefined;
  }
}
