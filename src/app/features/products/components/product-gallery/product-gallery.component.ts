import { Component, Input } from '@angular/core';
import { ProductImage } from '../../../../core/models/product.model';

@Component({
  selector: 'app-product-gallery',
  templateUrl: './product-gallery.component.html',
  styleUrls: ['./product-gallery.component.css']
})
export class ProductGalleryComponent {
  @Input() images: ProductImage[] = [];
  
  selectedIndex: number = 0;
  isZoomed: boolean = false;
  zoomPosition = { x: 0, y: 0 };

  get selectedImage(): ProductImage | undefined {
    return this.images[this.selectedIndex];
  }

  selectImage(index: number): void {
    this.selectedIndex = index;
  }

  previousImage(): void {
    this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : this.images.length - 1;
  }

  nextImage(): void {
    this.selectedIndex = this.selectedIndex < this.images.length - 1 ? this.selectedIndex + 1 : 0;
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isZoomed) return;
    
    const target = event.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    this.zoomPosition = { x, y };
  }

  onMouseEnter(): void {
    this.isZoomed = true;
  }

  onMouseLeave(): void {
    this.isZoomed = false;
  }
}
