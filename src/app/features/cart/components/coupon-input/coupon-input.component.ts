import { Component, Output, EventEmitter } from '@angular/core';
import { CartService } from '../../../../core/services/cart.service';

@Component({
  selector: 'app-coupon-input',
  templateUrl: './coupon-input.component.html',
  styleUrls: ['./coupon-input.component.css']
})
export class CouponInputComponent {
  @Output() couponApplied = new EventEmitter<{ success: boolean; message: string }>();

  couponCode: string = '';
  loading: boolean = false;
  isExpanded: boolean = false;

  constructor(private cartService: CartService) {}

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) {
      this.couponApplied.emit({ success: false, message: 'Por favor ingresa un codigo de cupon' });
      return;
    }

    this.loading = true;
    this.cartService.applyCoupon(this.couponCode.trim()).subscribe({
      next: () => {
        this.couponApplied.emit({ success: true, message: 'Cupon aplicado correctamente' });
        this.couponCode = '';
        this.loading = false;
      },
      error: (err) => {
        const message = err.error?.message || 'Cupon no valido o expirado';
        this.couponApplied.emit({ success: false, message });
        this.loading = false;
      }
    });
  }
}
