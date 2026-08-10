import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';

import { InvoiceListComponent } from './components/invoice-list/invoice-list.component';
import { InvoiceEntryComponent } from './components/invoice-entry/invoice-entry.component';
import { InvoiceCompareComponent } from './components/invoice-compare/invoice-compare.component';
import { SupplierReportComponent } from './components/supplier-report/supplier-report.component';
import { SupplierEntryComponent } from './components/supplier-entry/supplier-entry.component';
import { SupplierDirectoryComponent } from './components/supplier-directory/supplier-directory.component';
import { ProcurementDashboardComponent } from './components/procurement-dashboard/procurement-dashboard.component';

const routes: Routes = [
  { path: '', component: InvoiceListComponent },
  { path: 'new', component: InvoiceEntryComponent },
  { path: 'compare', component: InvoiceCompareComponent },
  { path: 'report', component: SupplierReportComponent },
  { path: 'analytics', component: ProcurementDashboardComponent },
  { path: 'suppliers', component: SupplierDirectoryComponent },
  { path: 'suppliers/new', component: SupplierEntryComponent }
];

@NgModule({
  declarations: [
    InvoiceListComponent,
    InvoiceEntryComponent,
    InvoiceCompareComponent,
    SupplierReportComponent,
    SupplierEntryComponent,
    SupplierDirectoryComponent,
    ProcurementDashboardComponent
  ],
  imports: [SharedModule, RouterModule.forChild(routes)]
})
export class InvoicesModule {}
