import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProductService } from '../../../../core/services/product.service';
import { CartService } from '../../../../core/services/cart.service';
import { WishlistService } from '../../../../core/services/wishlist.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Product, ProductVariant } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  product?: Product;
  relatedProducts: Product[] = [];
  selectedVariant?: ProductVariant;
  quantity: number = 1;
  
  loading = true;
  error = '';
  addingToCart = false;
  isInWishlist = false;
  
  activeTab: 'description' | 'specifications' | 'reviews' = 'description';
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductService,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['slug']) {
        this.loadProduct(params['slug']);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProduct(slug: string): void {
    this.loading = true;
    this.error = '';

    this.productService.getProductBySlug(slug).pipe(takeUntil(this.destroy$)).subscribe({
      next: (product) => {
        this.product = product;
        this.loading = false;
        this.isInWishlist = this.wishlistService.isInWishlist(product.id);
        this.loadRelatedProducts(product.id);
        
        if (product.variants && product.variants.length > 0) {
          this.selectedVariant = product.variants[0];
        }
      },
      error: (err) => {
        this.error = 'Producto no encontrado';
        this.loading = false;
        console.error('Error loading product:', err);
      }
    });
  }

  loadRelatedProducts(productId: string): void {
    this.productService.getRelatedProducts(productId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => this.relatedProducts = products,
      error: (err) => console.error('Error loading related products:', err)
    });
  }

  get currentPrice(): number {
    return this.selectedVariant?.price || this.product?.price || 0;
  }

  get currentStock(): number {
    return this.selectedVariant?.stock || this.product?.stock?.quantity || 0;
  }

  get isOutOfStock(): boolean {
    return this.currentStock <= 0;
  }

  get maxQuantity(): number {
    return Math.min(this.currentStock, 99);
  }

  onVariantChange(variant: ProductVariant): void {
    this.selectedVariant = variant;
    this.quantity = 1;
  }

  onQuantityChange(quantity: number): void {
    this.quantity = quantity;
  }

  addToCart(): void {
    if (!this.product || this.isOutOfStock || this.addingToCart) return;

    this.addingToCart = true;
    this.cartService.addToCart(this.product, this.quantity, this.selectedVariant).subscribe({
      next: () => {
        this.notificationService.success(`${this.product!.name} agregado al carrito`);
        this.addingToCart = false;
      },
      error: () => {
        this.notificationService.error('Error al agregar al carrito');
        this.addingToCart = false;
      }
    });
  }

  buyNow(): void {
    if (!this.product || this.isOutOfStock) return;

    this.cartService.addToCart(this.product, this.quantity, this.selectedVariant).subscribe({
      next: () => {
        this.router.navigate(['/checkout']);
      },
      error: () => {
        this.notificationService.error('Error al procesar la compra');
      }
    });
  }

  toggleWishlist(): void {
    if (!this.product) return;

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

  setActiveTab(tab: 'description' | 'specifications' | 'reviews'): void {
    this.activeTab = tab;
  }
}
