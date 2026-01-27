import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-price-display',
  templateUrl: './price-display.component.html',
  styleUrls: ['./price-display.component.css']
})
export class PriceDisplayComponent {
  @Input() price: number = 0;
  @Input() compareAtPrice?: number;
  @Input() currency: string = 'EUR';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showDiscount: boolean = true;

  get hasDiscount(): boolean {
    return !!this.compareAtPrice && this.compareAtPrice > this.price;
  }

  get discountPercentage(): number {
    if (!this.hasDiscount || !this.compareAtPrice) return 0;
    return Math.round((1 - this.price / this.compareAtPrice) * 100);
  }
}
