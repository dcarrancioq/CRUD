import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { OrderConfirmationComponent } from './components/order-confirmation/order-confirmation.component';
import { OrderHistoryComponent } from './components/order-history/order-history.component';
import { OrderDetailComponent } from './components/order-detail/order-detail.component';
import { OrderTrackingComponent } from './components/order-tracking/order-tracking.component';

const routes: Routes = [
  { path: '', component: OrderHistoryComponent },
  { path: 'confirmation/:orderNumber', component: OrderConfirmationComponent },
  { path: ':orderNumber', component: OrderDetailComponent },
  { path: ':orderNumber/tracking', component: OrderTrackingComponent }
];

@NgModule({
  declarations: [
    OrderConfirmationComponent,
    OrderHistoryComponent,
    OrderDetailComponent,
    OrderTrackingComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class OrdersModule { }
