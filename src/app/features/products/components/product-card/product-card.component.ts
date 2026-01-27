import { Component, Input } from '@angular/core';
import { Router } from '@angular/router';
import { Product } from '../../../../core/models/product.model';
import { CartService } from '../../../../core/services/cart.service';
import { WishlistService } from '../../../../core/services/wishlist.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-product-card',
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.css']
})
export class ProductCardComponent {
  @Input() product!: Product;
  @Input() horizontal: boolean = false;

  isInWishlist = false;
  addingToCart = false;

  constructor(
    private router: Router,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.isInWishlist = this.wishlistService.isInWishlist(this.product.id);
  }

  get mainImage(): string {
    const main = this.product.images?.find(img => img.isMain);
    return main?.url || this.product.images?.[0]?.url || 'assets/images/placeholder.png';
  }

  get isOutOfStock(): boolean {
    return this.product.stock?.status === 'out_of_stock';
  }

  get hasDiscount(): boolean {
    return !!this.product.compareAtPrice && this.product.compareAtPrice > this.product.price;
  }

  get discountPercentage(): number {
    if (!this.hasDiscount || !this.product.compareAtPrice) return 0;
    return Math.round((1 - this.product.price / this.product.compareAtPrice) * 100);
  }

  goToProduct(): void {
    this.router.navigate(['/products', this.product.slug]);
  }

  addToCart(event: Event): void {
    event.stopPropagation();
    if (this.isOutOfStock || this.addingToCart) return;

    this.addingToCart = true;
    this.cartService.addToCart(this.product, 1).subscribe({
      next: () => {
        this.notificationService.success('Producto agregado al carrito');
        this.addingToCart = false;
      },
      error: () => {
        this.notificationService.error('Error al agregar al carrito');
        this.addingToCart = false;
      }
    });
  }

  toggleWishlist(event: Event): void {
    event.stopPropagation();
    if (this.isInWishlist) {
      this.wishlistService.removeFromWishlist(this.product.id).subscribe(() => {
        this.isInWishlist = false;
        this.notificationService.info('Producto eliminado de favoritos');
      });
    } else {
      this.wishlistService.addToWishlist(this.product).subscribe(() => {
        this.isInWishlist = true;
        this.notificationService.success('Producto agregado a favoritos');
      });
    }
  }
}
