import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { CheckoutPageComponent } from './components/checkout-page/checkout-page.component';
import { CheckoutStepsComponent } from './components/checkout-steps/checkout-steps.component';
import { CustomerInfoFormComponent } from './components/customer-info-form/customer-info-form.component';
import { ShippingFormComponent } from './components/shipping-form/shipping-form.component';
import { PaymentFormComponent } from './components/payment-form/payment-form.component';
import { OrderReviewComponent } from './components/order-review/order-review.component';

const routes: Routes = [
  { path: '', component: CheckoutPageComponent }
];

@NgModule({
  declarations: [
    CheckoutPageComponent,
    CheckoutStepsComponent,
    CustomerInfoFormComponent,
    ShippingFormComponent,
    PaymentFormComponent,
    OrderReviewComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class CheckoutModule { }
