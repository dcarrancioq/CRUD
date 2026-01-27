import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { 
  Cart, 
  CartItem, 
  CartSummary, 
  AddToCartRequest, 
  UpdateCartItemRequest,
  ApplyCouponRequest,
  AppliedCoupon
} from '../models/cart.model';
import { Product, ProductVariant } from '../models/product.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private readonly API_URL = `${environment.apiUrl}/cart`;
  private readonly STORAGE_KEY = 'shopping_cart';
  
  private cartSubject = new BehaviorSubject<Cart | null>(null);
  private cartCountSubject = new BehaviorSubject<number>(0);

  cart$ = this.cartSubject.asObservable();
  cartCount$ = this.cartCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.initializeCart();
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.syncCartWithServer();
      }
    });
  }

  private initializeCart(): void {
    const storedCart = localStorage.getItem(this.STORAGE_KEY);
    if (storedCart) {
      const cart = JSON.parse(storedCart) as Cart;
      this.cartSubject.next(cart);
      this.updateCartCount(cart);
    } else {
      this.cartSubject.next(this.createEmptyCart());
    }
  }

  private createEmptyCart(): Cart {
    return {
      id: this.generateId(),
      sessionId: this.getSessionId(),
      items: [],
      subtotal: 0,
      discount: 0,
      shipping: 0,
      tax: 0,
      total: 0,
      appliedCoupons: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateId(): string {
    return 'cart_' + Math.random().toString(36).substr(2, 9);
  }

  private getSessionId(): string {
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = 'session_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }

  getCart(): Observable<Cart> {
    if (this.authService.isAuthenticated) {
      return this.http.get<Cart>(this.API_URL).pipe(
        tap(cart => {
          this.cartSubject.next(cart);
          this.updateCartCount(cart);
          this.saveToStorage(cart);
        }),
        catchError(() => of(this.cartSubject.value || this.createEmptyCart()))
      );
    }
    return of(this.cartSubject.value || this.createEmptyCart());
  }

  addToCart(product: Product, quantity: number = 1, variant?: ProductVariant): Observable<Cart> {
    const cart = this.cartSubject.value || this.createEmptyCart();
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === product.id && item.variantId === variant?.id
    );

    if (existingItemIndex > -1) {
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].totalPrice = 
        cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].unitPrice;
    } else {
      const newItem: CartItem = {
        id: this.generateId(),
        productId: product.id,
        variantId: variant?.id,
        product: product,
        variant: variant,
        quantity: quantity,
        unitPrice: variant?.price || product.price,
        totalPrice: (variant?.price || product.price) * quantity
      };
      cart.items.push(newItem);
    }

    this.recalculateCart(cart);

    if (this.authService.isAuthenticated) {
      const request: AddToCartRequest = {
        productId: product.id,
        variantId: variant?.id,
        quantity: quantity
      };
      return this.http.post<Cart>(`${this.API_URL}/items`, request).pipe(
        tap(updatedCart => {
          this.cartSubject.next(updatedCart);
          this.updateCartCount(updatedCart);
          this.saveToStorage(updatedCart);
        }),
        catchError(() => {
          this.cartSubject.next(cart);
          this.updateCartCount(cart);
          this.saveToStorage(cart);
          return of(cart);
        })
      );
    }

    this.cartSubject.next(cart);
    this.updateCartCount(cart);
    this.saveToStorage(cart);
    return of(cart);
  }

  updateItemQuantity(itemId: string, quantity: number): Observable<Cart> {
    const cart = this.cartSubject.value;
    if (!cart) return of(this.createEmptyCart());

    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return of(cart);

    if (quantity <= 0) {
      return this.removeItem(itemId);
    }

    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].totalPrice = cart.items[itemIndex].unitPrice * quantity;
    this.recalculateCart(cart);

    if (this.authService.isAuthenticated) {
      const request: UpdateCartItemRequest = { quantity };
      return this.http.put<Cart>(`${this.API_URL}/items/${itemId}`, request).pipe(
        tap(updatedCart => {
          this.cartSubject.next(updatedCart);
          this.updateCartCount(updatedCart);
          this.saveToStorage(updatedCart);
        }),
        catchError(() => {
          this.cartSubject.next(cart);
          this.updateCartCount(cart);
          this.saveToStorage(cart);
          return of(cart);
        })
      );
    }

    this.cartSubject.next(cart);
    this.updateCartCount(cart);
    this.saveToStorage(cart);
    return of(cart);
  }

  removeItem(itemId: string): Observable<Cart> {
    const cart = this.cartSubject.value;
    if (!cart) return of(this.createEmptyCart());

    cart.items = cart.items.filter(item => item.id !== itemId);
    this.recalculateCart(cart);

    if (this.authService.isAuthenticated) {
      return this.http.delete<Cart>(`${this.API_URL}/items/${itemId}`).pipe(
        tap(updatedCart => {
          this.cartSubject.next(updatedCart);
          this.updateCartCount(updatedCart);
          this.saveToStorage(updatedCart);
        }),
        catchError(() => {
          this.cartSubject.next(cart);
          this.updateCartCount(cart);
          this.saveToStorage(cart);
          return of(cart);
        })
      );
    }

    this.cartSubject.next(cart);
    this.updateCartCount(cart);
    this.saveToStorage(cart);
    return of(cart);
  }

  clearCart(): Observable<void> {
    const emptyCart = this.createEmptyCart();
    
    if (this.authService.isAuthenticated) {
      return this.http.delete<void>(this.API_URL).pipe(
        tap(() => {
          this.cartSubject.next(emptyCart);
          this.updateCartCount(emptyCart);
          this.saveToStorage(emptyCart);
        }),
        catchError(() => {
          this.cartSubject.next(emptyCart);
          this.updateCartCount(emptyCart);
          this.saveToStorage(emptyCart);
          return of(undefined);
        })
      );
    }

    this.cartSubject.next(emptyCart);
    this.updateCartCount(emptyCart);
    this.saveToStorage(emptyCart);
    return of(undefined);
  }

  applyCoupon(code: string): Observable<{ success: boolean; message: string; cart?: Cart }> {
    const request: ApplyCouponRequest = { code };
    
    if (this.authService.isAuthenticated) {
      return this.http.post<{ success: boolean; message: string; cart?: Cart }>(
        `${this.API_URL}/coupons`, 
        request
      ).pipe(
        tap(response => {
          if (response.success && response.cart) {
            this.cartSubject.next(response.cart);
            this.updateCartCount(response.cart);
            this.saveToStorage(response.cart);
          }
        })
      );
    }

    return this.http.post<{ success: boolean; message: string; discount?: number }>(
      `${environment.apiUrl}/coupons/validate`,
      request
    ).pipe(
      map(response => {
        if (response.success && response.discount) {
          const cart = this.cartSubject.value;
          if (cart) {
            const appliedCoupon: AppliedCoupon = {
              code: code,
              discountType: 'fixed',
              discountValue: response.discount,
              appliedDiscount: response.discount
            };
            cart.appliedCoupons = [appliedCoupon];
            this.recalculateCart(cart);
            this.cartSubject.next(cart);
            this.saveToStorage(cart);
            return { success: true, message: 'Coupon applied successfully', cart };
          }
        }
        return { success: false, message: response.message || 'Invalid coupon' };
      })
    );
  }

  removeCoupon(code: string): Observable<Cart> {
    const cart = this.cartSubject.value;
    if (!cart) return of(this.createEmptyCart());

    cart.appliedCoupons = cart.appliedCoupons.filter(c => c.code !== code);
    this.recalculateCart(cart);

    if (this.authService.isAuthenticated) {
      return this.http.delete<Cart>(`${this.API_URL}/coupons/${code}`).pipe(
        tap(updatedCart => {
          this.cartSubject.next(updatedCart);
          this.saveToStorage(updatedCart);
        }),
        catchError(() => {
          this.cartSubject.next(cart);
          this.saveToStorage(cart);
          return of(cart);
        })
      );
    }

    this.cartSubject.next(cart);
    this.saveToStorage(cart);
    return of(cart);
  }

  getCartSummary(): CartSummary {
    const cart = this.cartSubject.value;
    if (!cart) {
      return { itemCount: 0, subtotal: 0, discount: 0, shipping: 0, tax: 0, total: 0 };
    }
    return {
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: cart.subtotal,
      discount: cart.discount,
      shipping: cart.shipping,
      tax: cart.tax,
      total: cart.total
    };
  }

  private recalculateCart(cart: Cart): void {
    cart.subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    cart.discount = cart.appliedCoupons.reduce((sum, coupon) => sum + coupon.appliedDiscount, 0);
    cart.tax = (cart.subtotal - cart.discount) * 0.21; // 21% IVA
    cart.total = cart.subtotal - cart.discount + cart.shipping + cart.tax;
    cart.updatedAt = new Date();
  }

  private updateCartCount(cart: Cart): void {
    const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    this.cartCountSubject.next(count);
  }

  private saveToStorage(cart: Cart): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cart));
  }

  private syncCartWithServer(): void {
    const localCart = this.cartSubject.value;
    if (localCart && localCart.items.length > 0) {
      this.http.post<Cart>(`${this.API_URL}/merge`, { items: localCart.items }).pipe(
        tap(mergedCart => {
          this.cartSubject.next(mergedCart);
          this.updateCartCount(mergedCart);
          this.saveToStorage(mergedCart);
        }),
        catchError(() => of(null))
      ).subscribe();
    } else {
      this.getCart().subscribe();
    }
  }
}
