import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Cart } from '../../../../core/models/cart.model';
import { CheckoutData } from '../../../../core/models/order.model';

@Component({
  selector: 'app-order-review',
  templateUrl: './order-review.component.html',
  styleUrls: ['./order-review.component.css']
})
export class OrderReviewComponent {
  @Input() cart!: Cart | null;
  @Input() checkoutData!: CheckoutData | null;
  @Input() placing: boolean = false;
  @Output() placeOrder = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  acceptedTerms: boolean = false;

  get canPlaceOrder(): boolean {
    return this.acceptedTerms && !this.placing;
  }

  get paymentMethodName(): string {
    switch (this.checkoutData?.paymentMethod) {
      case 'card': return 'Tarjeta de credito/debito';
      case 'paypal': return 'PayPal';
      case 'transfer': return 'Transferencia bancaria';
      default: return '';
    }
  }

  onPlaceOrder(): void {
    if (this.canPlaceOrder) {
      this.placeOrder.emit();
    }
  }

  onBack(): void {
    this.back.emit();
  }
}
