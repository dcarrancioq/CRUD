import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Cart } from '../../../../core/models/cart.model';

@Component({
  selector: 'app-cart-summary',
  templateUrl: './cart-summary.component.html',
  styleUrls: ['./cart-summary.component.css']
})
export class CartSummaryComponent {
  @Input() cart!: Cart;
  @Input() showCheckoutButton: boolean = true;
  @Output() checkout = new EventEmitter<void>();

  onCheckout(): void {
    this.checkout.emit();
  }
}
