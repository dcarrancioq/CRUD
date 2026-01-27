import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { 
  Product, 
  ProductQueryParams, 
  PaginatedResponse, 
  Category,
  Review
} from '../models/product.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly API_URL = `${environment.apiUrl}/products`;

  constructor(private http: HttpClient) {}

  getProducts(params: ProductQueryParams = {}): Observable<PaginatedResponse<Product>> {
    let httpParams = new HttpParams();
    
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.minPrice) httpParams = httpParams.set('minPrice', params.minPrice.toString());
    if (params.maxPrice) httpParams = httpParams.set('maxPrice', params.maxPrice.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);
    if (params.search) httpParams = httpParams.set('search', params.search);
    if (params.inStock !== undefined) httpParams = httpParams.set('inStock', params.inStock.toString());

    return this.http.get<PaginatedResponse<Product>>(this.API_URL, { params: httpParams });
  }

  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/${id}`);
  }

  getProductBySlug(slug: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/slug/${slug}`);
  }

  searchProducts(query: string, limit: number = 10): Observable<Product[]> {
    const params = new HttpParams()
      .set('search', query)
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<Product>>(this.API_URL, { params }).pipe(
      map(response => response.data)
    );
  }

  getProductsByCategory(categoryId: string, params: ProductQueryParams = {}): Observable<PaginatedResponse<Product>> {
    return this.getProducts({ ...params, category: categoryId });
  }

  getRelatedProducts(productId: string, limit: number = 4): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/${productId}/related`, {
      params: new HttpParams().set('limit', limit.toString())
    });
  }

  getFeaturedProducts(limit: number = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/featured`, {
      params: new HttpParams().set('limit', limit.toString())
    });
  }

  getNewArrivals(limit: number = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/new-arrivals`, {
      params: new HttpParams().set('limit', limit.toString())
    });
  }

  getBestSellers(limit: number = 8): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/best-sellers`, {
      params: new HttpParams().set('limit', limit.toString())
    });
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${environment.apiUrl}/categories`);
  }

  getCategoryBySlug(slug: string): Observable<Category> {
    return this.http.get<Category>(`${environment.apiUrl}/categories/slug/${slug}`);
  }

  getProductReviews(productId: string, page: number = 1, limit: number = 10): Observable<PaginatedResponse<Review>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedResponse<Review>>(`${this.API_URL}/${productId}/reviews`, { params });
  }

  submitReview(productId: string, review: { rating: number; title: string; comment: string }): Observable<Review> {
    return this.http.post<Review>(`${this.API_URL}/${productId}/reviews`, review);
  }

  checkStock(productId: string, variantId?: string, quantity: number = 1): Observable<{ available: boolean; stock: number }> {
    let params = new HttpParams().set('quantity', quantity.toString());
    if (variantId) params = params.set('variantId', variantId);
    return this.http.get<{ available: boolean; stock: number }>(`${this.API_URL}/${productId}/stock`, { params });
  }
}
