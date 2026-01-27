import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { ProductManagementComponent } from './components/product-management/product-management.component';
import { ProductFormComponent } from './components/product-form/product-form.component';
import { OrderManagementComponent } from './components/order-management/order-management.component';
import { CustomerManagementComponent } from './components/customer-management/customer-management.component';
import { CouponManagementComponent } from './components/coupon-management/coupon-management.component';

const routes: Routes = [
  { path: '', component: AdminDashboardComponent },
  { path: 'products', component: ProductManagementComponent },
  { path: 'products/new', component: ProductFormComponent },
  { path: 'products/:id/edit', component: ProductFormComponent },
  { path: 'orders', component: OrderManagementComponent },
  { path: 'customers', component: CustomerManagementComponent },
  { path: 'coupons', component: CouponManagementComponent }
];

@NgModule({
  declarations: [
    AdminDashboardComponent,
    ProductManagementComponent,
    ProductFormComponent,
    OrderManagementComponent,
    CustomerManagementComponent,
    CouponManagementComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class AdminModule { }
