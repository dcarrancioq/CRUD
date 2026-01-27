import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CartItem } from '../../../../core/models/cart.model';

@Component({
  selector: 'app-cart-item',
  templateUrl: './cart-item.component.html',
  styleUrls: ['./cart-item.component.css']
})
export class CartItemComponent {
  @Input() item!: CartItem;
  @Output() quantityChange = new EventEmitter<number>();
  @Output() remove = new EventEmitter<void>();

  get productImage(): string {
    return this.item.product?.images?.[0]?.url || 'assets/images/placeholder.png';
  }

  get productName(): string {
    let name = this.item.product?.name || '';
    if (this.item.variant) {
      name += ` - ${this.item.variant.name}`;
    }
    return name;
  }

  get maxQuantity(): number {
    return this.item.variant?.stock || this.item.product?.stock?.quantity || 99;
  }

  onQuantityChange(quantity: number): void {
    this.quantityChange.emit(quantity);
  }

  onRemove(): void {
    this.remove.emit();
  }
}
