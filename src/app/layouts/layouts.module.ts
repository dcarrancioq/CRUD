import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../shared/shared.module';

import { MainLayoutComponent } from './main-layout/main-layout.component';
import { AdminLayoutComponent } from './admin-layout/admin-layout.component';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { AdminSidebarComponent } from './components/admin-sidebar/admin-sidebar.component';

@NgModule({
  declarations: [
    MainLayoutComponent,
    AdminLayoutComponent,
    HeaderComponent,
    FooterComponent,
    AdminSidebarComponent
  ],
  imports: [
    SharedModule,
    RouterModule
  ],
  exports: [
    MainLayoutComponent,
    AdminLayoutComponent
  ]
})
export class LayoutsModule { }
