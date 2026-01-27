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
  @Input() checkoutData!: Partial<CheckoutData> | null;
  @Input() placing: boolean = false;
  @Output() placeOrder = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  acceptedTerms: boolean = false;

  get canPlaceOrder(): boolean {
    return this.acceptedTerms && !this.placing;
  }

  get paymentMethodName(): string {
    const type = this.checkoutData?.paymentMethod?.type;
    switch (type) {
      case 'credit_card': 
      case 'debit_card': return 'Tarjeta de credito/debito';
      case 'paypal': return 'PayPal';
      case 'bank_transfer': return 'Transferencia bancaria';
      case 'wallet': return 'Wallet digital';
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
