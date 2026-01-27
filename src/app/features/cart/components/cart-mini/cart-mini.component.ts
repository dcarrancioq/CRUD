import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CartService } from '../../../../core/services/cart.service';
import { Cart, CartItem } from '../../../../core/models/cart.model';

@Component({
  selector: 'app-cart-mini',
  templateUrl: './cart-mini.component.html',
  styleUrls: ['./cart-mini.component.css']
})
export class CartMiniComponent implements OnInit, OnDestroy {
  cart: Cart | null = null;
  cartCount: number = 0;
  isOpen: boolean = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.cart$.pipe(takeUntil(this.destroy$)).subscribe(cart => {
      this.cart = cart;
    });

    this.cartService.cartCount$.pipe(takeUntil(this.destroy$)).subscribe(count => {
      this.cartCount = count;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleCart(): void {
    this.isOpen = !this.isOpen;
  }

  closeCart(): void {
    this.isOpen = false;
  }

  getItemImage(item: CartItem): string {
    return item.product?.images?.[0]?.url || 'assets/images/placeholder.png';
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.id).subscribe();
  }

  goToCart(): void {
    this.closeCart();
    this.router.navigate(['/cart']);
  }

  goToCheckout(): void {
    this.closeCart();
    this.router.navigate(['/checkout']);
  }
}
