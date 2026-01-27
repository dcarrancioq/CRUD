import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ProductVariant } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-variant-selector',
  templateUrl: './product-variant-selector.component.html',
  styleUrls: ['./product-variant-selector.component.css']
})
export class ProductVariantSelectorComponent {
  @Input() variants: ProductVariant[] = [];
  @Input() selectedVariant?: ProductVariant;
  @Output() variantChange = new EventEmitter<ProductVariant>();

  get groupedAttributes(): { name: string; values: { value: string; variant: ProductVariant }[] }[] {
    const groups: { [key: string]: { value: string; variant: ProductVariant }[] } = {};
    
    this.variants.forEach(variant => {
      variant.attributes.forEach(attr => {
        if (!groups[attr.name]) {
          groups[attr.name] = [];
        }
        if (!groups[attr.name].some(v => v.value === attr.value)) {
          groups[attr.name].push({ value: attr.value, variant });
        }
      });
    });

    return Object.keys(groups).map(name => ({
      name,
      values: groups[name]
    }));
  }

  selectVariant(variant: ProductVariant): void {
    this.variantChange.emit(variant);
  }

  isSelected(variant: ProductVariant): boolean {
    return this.selectedVariant?.id === variant.id;
  }

  isAvailable(variant: ProductVariant): boolean {
    return variant.stock > 0;
  }
}
