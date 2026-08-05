import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { AuthInterceptor } from './interceptors/auth.interceptor';
import { ErrorInterceptor } from './interceptors/error.interceptor';
import { LoadingInterceptor } from './interceptors/loading.interceptor';

import { AuthService } from './services/auth.service';
import { ProductService } from './services/product.service';
import { CartService } from './services/cart.service';
import { OrderService } from './services/order.service';
import { CheckoutService } from './services/checkout.service';
import { WishlistService } from './services/wishlist.service';
import { AdminService } from './services/admin.service';
import { LoadingService } from './services/loading.service';
import { NotificationService } from './services/notification.service';
import { InvoiceService } from './services/invoice.service';
import { ProcurementMasterDataService } from './services/procurement-master-data.service';
import { DevinApiService } from './services/devin-api.service';

import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { GuestGuard } from './guards/guest.guard';
import { CheckoutGuard } from './guards/checkout.guard';

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  providers: [
    AuthService,
    ProductService,
    CartService,
    OrderService,
    CheckoutService,
    WishlistService,
    AdminService,
    LoadingService,
    NotificationService,
    ProcurementMasterDataService,
    InvoiceService,
    DevinApiService,
    AuthGuard,
    AdminGuard,
    GuestGuard,
    CheckoutGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: LoadingInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only.');
    }
  }
}
