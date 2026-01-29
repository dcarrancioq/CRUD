import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminGuard } from './core/guards/admin.guard';

const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', redirectTo: 'products', pathMatch: 'full' },
      {
        path: 'products',
        loadChildren: () => import('./features/products/products.module').then(m => m.ProductsModule)
      },
      {
        path: 'cart',
        loadChildren: () => import('./features/cart/cart.module').then(m => m.CartModule)
      },
      {
        path: 'checkout',
        loadChildren: () => import('./features/checkout/checkout.module').then(m => m.CheckoutModule),
        canActivate: [AuthGuard]
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.module').then(m => m.OrdersModule),
        canActivate: [AuthGuard]
      }
    ]
  },
    {
      path: 'auth',
      loadChildren: () => import('./features/auth/auth.module').then(m => m.AuthModule)
    },
    {
      path: 'legal',
      loadChildren: () => import('./features/legal/legal.module').then(m => m.LegalModule)
    },
    {
      path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard, AdminGuard],
    loadChildren: () => import('./features/admin/admin.module').then(m => m.AdminModule)
  },
  { path: '**', redirectTo: 'products' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
