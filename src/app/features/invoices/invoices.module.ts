import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { InvoiceListComponent } from './components/invoice-list/invoice-list.component';
import { InvoiceEntryComponent } from './components/invoice-entry/invoice-entry.component';
import { InvoiceCompareComponent } from './components/invoice-compare/invoice-compare.component';
import { SupplierReportComponent } from './components/supplier-report/supplier-report.component';
import { SupplierEntryComponent } from './components/supplier-entry/supplier-entry.component';

const routes: Routes = [
  { path: '', component: InvoiceListComponent },
  { path: 'new', component: InvoiceEntryComponent },
  { path: 'compare', component: InvoiceCompareComponent },
  { path: 'report', component: SupplierReportComponent },
  { path: 'suppliers/new', component: SupplierEntryComponent }
];

@NgModule({
  declarations: [
    InvoiceListComponent,
    InvoiceEntryComponent,
    InvoiceCompareComponent,
    SupplierReportComponent,
    SupplierEntryComponent
  ],
  imports: [SharedModule, RouterModule.forChild(routes)]
})
export class InvoicesModule {}
