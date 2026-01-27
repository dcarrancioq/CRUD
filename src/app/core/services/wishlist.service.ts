import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { Product } from '../models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  addedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class WishlistService {
  private readonly API_URL = `${environment.apiUrl}/wishlist`;
  private readonly STORAGE_KEY = 'wishlist';
  
  private wishlistSubject = new BehaviorSubject<WishlistItem[]>([]);
  private wishlistCountSubject = new BehaviorSubject<number>(0);

  wishlist$ = this.wishlistSubject.asObservable();
  wishlistCount$ = this.wishlistCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeWishlist();
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.syncWithServer();
      }
    });
  }

  private initializeWishlist(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      const items = JSON.parse(stored) as WishlistItem[];
      this.wishlistSubject.next(items);
      this.wishlistCountSubject.next(items.length);
    }
  }

  getWishlist(): Observable<WishlistItem[]> {
    if (this.authService.isAuthenticated) {
      return this.http.get<WishlistItem[]>(this.API_URL).pipe(
        tap(items => {
          this.wishlistSubject.next(items);
          this.wishlistCountSubject.next(items.length);
          this.saveToStorage(items);
        }),
        catchError(() => of(this.wishlistSubject.value))
      );
    }
    return of(this.wishlistSubject.value);
  }

  addToWishlist(product: Product): Observable<WishlistItem> {
    const items = this.wishlistSubject.value;
    const exists = items.some(item => item.productId === product.id);
    
    if (exists) {
      const existingItem = items.find(item => item.productId === product.id)!;
      return of(existingItem);
    }

    const newItem: WishlistItem = {
      id: this.generateId(),
      productId: product.id,
      product: product,
      addedAt: new Date()
    };

    if (this.authService.isAuthenticated) {
      return this.http.post<WishlistItem>(this.API_URL, { productId: product.id }).pipe(
        tap(item => {
          const updatedItems = [...items, item];
          this.wishlistSubject.next(updatedItems);
          this.wishlistCountSubject.next(updatedItems.length);
          this.saveToStorage(updatedItems);
        }),
        catchError(() => {
          const updatedItems = [...items, newItem];
          this.wishlistSubject.next(updatedItems);
          this.wishlistCountSubject.next(updatedItems.length);
          this.saveToStorage(updatedItems);
          return of(newItem);
        })
      );
    }

    const updatedItems = [...items, newItem];
    this.wishlistSubject.next(updatedItems);
    this.wishlistCountSubject.next(updatedItems.length);
    this.saveToStorage(updatedItems);
    return of(newItem);
  }

  removeFromWishlist(productId: string): Observable<void> {
    const items = this.wishlistSubject.value;
    const updatedItems = items.filter(item => item.productId !== productId);

    if (this.authService.isAuthenticated) {
      return this.http.delete<void>(`${this.API_URL}/${productId}`).pipe(
        tap(() => {
          this.wishlistSubject.next(updatedItems);
          this.wishlistCountSubject.next(updatedItems.length);
          this.saveToStorage(updatedItems);
        }),
        catchError(() => {
          this.wishlistSubject.next(updatedItems);
          this.wishlistCountSubject.next(updatedItems.length);
          this.saveToStorage(updatedItems);
          return of(undefined);
        })
      );
    }

    this.wishlistSubject.next(updatedItems);
    this.wishlistCountSubject.next(updatedItems.length);
    this.saveToStorage(updatedItems);
    return of(undefined);
  }

  isInWishlist(productId: string): boolean {
    return this.wishlistSubject.value.some(item => item.productId === productId);
  }

  isInWishlist$(productId: string): Observable<boolean> {
    return this.wishlist$.pipe(
      map(items => items.some(item => item.productId === productId))
    );
  }

  clearWishlist(): Observable<void> {
    if (this.authService.isAuthenticated) {
      return this.http.delete<void>(this.API_URL).pipe(
        tap(() => {
          this.wishlistSubject.next([]);
          this.wishlistCountSubject.next(0);
          this.saveToStorage([]);
        }),
        catchError(() => {
          this.wishlistSubject.next([]);
          this.wishlistCountSubject.next(0);
          this.saveToStorage([]);
          return of(undefined);
        })
      );
    }

    this.wishlistSubject.next([]);
    this.wishlistCountSubject.next(0);
    this.saveToStorage([]);
    return of(undefined);
  }

  private generateId(): string {
    return 'wish_' + Math.random().toString(36).substr(2, 9);
  }

  private saveToStorage(items: WishlistItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
  }

  private syncWithServer(): void {
    const localItems = this.wishlistSubject.value;
    if (localItems.length > 0) {
      const productIds = localItems.map(item => item.productId);
      this.http.post<WishlistItem[]>(`${this.API_URL}/merge`, { productIds }).pipe(
        tap(items => {
          this.wishlistSubject.next(items);
          this.wishlistCountSubject.next(items.length);
          this.saveToStorage(items);
        }),
        catchError(() => of(null))
      ).subscribe();
    } else {
      this.getWishlist().subscribe();
    }
  }
}
