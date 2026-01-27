import { Component, Output, EventEmitter } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ProductService } from '../../../../core/services/product.service';
import { Product } from '../../../../core/models/product.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-product-search',
  templateUrl: './product-search.component.html',
  styleUrls: ['./product-search.component.css']
})
export class ProductSearchComponent {
  @Output() search = new EventEmitter<string>();

  searchQuery: string = '';
  suggestions: Product[] = [];
  showSuggestions: boolean = false;
  loading: boolean = false;

  private searchSubject = new Subject<string>();

  constructor(
    private productService: ProductService,
    private router: Router
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.length < 2) {
          this.suggestions = [];
          return [];
        }
        this.loading = true;
        return this.productService.searchProducts(query, 5);
      })
    ).subscribe({
      next: (products) => {
        this.suggestions = products;
        this.loading = false;
      },
      error: () => {
        this.suggestions = [];
        this.loading = false;
      }
    });
  }

  onInputChange(): void {
    this.searchSubject.next(this.searchQuery);
    this.showSuggestions = true;
  }

  onSubmit(): void {
    if (this.searchQuery.trim()) {
      this.search.emit(this.searchQuery);
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
      this.hideSuggestions();
    }
  }

  selectProduct(product: Product): void {
    this.router.navigate(['/products', product.slug]);
    this.hideSuggestions();
    this.searchQuery = '';
  }

  hideSuggestions(): void {
    setTimeout(() => {
      this.showSuggestions = false;
    }, 200);
  }

  onFocus(): void {
    if (this.suggestions.length > 0) {
      this.showSuggestions = true;
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.suggestions = [];
    this.showSuggestions = false;
  }
}
