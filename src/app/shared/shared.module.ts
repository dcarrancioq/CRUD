import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { NotificationComponent } from './components/notification/notification.component';
import { PaginationComponent } from './components/pagination/pagination.component';
import { QuantitySelectorComponent } from './components/quantity-selector/quantity-selector.component';
import { RatingStarsComponent } from './components/rating-stars/rating-stars.component';
import { PriceDisplayComponent } from './components/price-display/price-display.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { CookieConsentComponent } from './components/cookie-consent/cookie-consent.component';

import { CurrencyFormatPipe } from './pipes/currency-format.pipe';
import { TruncatePipe } from './pipes/truncate.pipe';
import { TimeAgoPipe } from './pipes/time-ago.pipe';

@NgModule({
  declarations: [
    LoadingSpinnerComponent,
    NotificationComponent,
    PaginationComponent,
    QuantitySelectorComponent,
    RatingStarsComponent,
    PriceDisplayComponent,
    EmptyStateComponent,
        ConfirmDialogComponent,
        BreadcrumbComponent,
        CookieConsentComponent,
        CurrencyFormatPipe,
    TruncatePipe,
    TimeAgoPipe
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    LoadingSpinnerComponent,
    NotificationComponent,
    PaginationComponent,
    QuantitySelectorComponent,
    RatingStarsComponent,
    PriceDisplayComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    BreadcrumbComponent,
    CookieConsentComponent,
    CurrencyFormatPipe,
    TruncatePipe,
    TimeAgoPipe
  ]
})
export class SharedModule { }
