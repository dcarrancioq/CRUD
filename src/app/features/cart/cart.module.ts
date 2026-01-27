import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { CartPageComponent } from './components/cart-page/cart-page.component';
import { CartItemComponent } from './components/cart-item/cart-item.component';
import { CartSummaryComponent } from './components/cart-summary/cart-summary.component';
import { CartMiniComponent } from './components/cart-mini/cart-mini.component';
import { CouponInputComponent } from './components/coupon-input/coupon-input.component';

const routes: Routes = [
  { path: '', component: CartPageComponent }
];

@NgModule({
  declarations: [
    CartPageComponent,
    CartItemComponent,
    CartSummaryComponent,
    CartMiniComponent,
    CouponInputComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    CartMiniComponent
  ]
})
export class CartModule { }
