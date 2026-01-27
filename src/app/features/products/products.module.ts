import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { ProductListComponent } from './components/product-list/product-list.component';
import { ProductDetailComponent } from './components/product-detail/product-detail.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductGalleryComponent } from './components/product-gallery/product-gallery.component';
import { ProductVariantSelectorComponent } from './components/product-variant-selector/product-variant-selector.component';
import { ProductReviewsComponent } from './components/product-reviews/product-reviews.component';
import { ProductFilterComponent } from './components/product-filter/product-filter.component';
import { ProductSearchComponent } from './components/product-search/product-search.component';

const routes: Routes = [
  { path: '', component: ProductListComponent },
  { path: 'category/:slug', component: ProductListComponent },
  { path: ':slug', component: ProductDetailComponent }
];

@NgModule({
  declarations: [
    ProductListComponent,
    ProductDetailComponent,
    ProductCardComponent,
    ProductGalleryComponent,
    ProductVariantSelectorComponent,
    ProductReviewsComponent,
    ProductFilterComponent,
    ProductSearchComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    ProductCardComponent,
    ProductSearchComponent
  ]
})
export class ProductsModule { }
