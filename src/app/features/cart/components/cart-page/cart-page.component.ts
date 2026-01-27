import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CartService } from '../../../../core/services/cart.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Cart, CartItem } from '../../../../core/models/cart.model';

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.css']
})
export class CartPageComponent implements OnInit, OnDestroy {
  cart: Cart | null = null;
  loading = true;
  updating = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private cartService: CartService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cartService.cart$.pipe(takeUntil(this.destroy$)).subscribe(cart => {
      this.cart = cart;
      this.loading = false;
    });

    this.cartService.getCart().subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isEmpty(): boolean {
    return !this.cart || this.cart.items.length === 0;
  }

  onQuantityChange(item: CartItem, quantity: number): void {
    this.updating = true;
    this.cartService.updateItemQuantity(item.id, quantity).subscribe({
      next: () => {
        this.updating = false;
      },
      error: () => {
        this.notificationService.error('Error al actualizar la cantidad');
        this.updating = false;
      }
    });
  }

  onRemoveItem(item: CartItem): void {
    this.updating = true;
    this.cartService.removeItem(item.id).subscribe({
      next: () => {
        this.notificationService.info('Producto eliminado del carrito');
        this.updating = false;
      },
      error: () => {
        this.notificationService.error('Error al eliminar el producto');
        this.updating = false;
      }
    });
  }

  onClearCart(): void {
    if (confirm('¿Está seguro de vaciar el carrito?')) {
      this.cartService.clearCart().subscribe({
        next: () => {
          this.notificationService.info('Carrito vaciado');
        },
        error: () => {
          this.notificationService.error('Error al vaciar el carrito');
        }
      });
    }
  }

  onCouponApplied(result: { success: boolean; message: string }): void {
    if (result.success) {
      this.notificationService.success(result.message);
    } else {
      this.notificationService.error(result.message);
    }
  }

  proceedToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.router.navigate(['/products']);
  }
}
