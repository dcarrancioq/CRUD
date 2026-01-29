import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';

import { PrivacyPolicyComponent } from './pages/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from './pages/terms-conditions/terms-conditions.component';
import { CookiePolicyComponent } from './pages/cookie-policy/cookie-policy.component';

const routes: Routes = [
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'terms-conditions', component: TermsConditionsComponent },
  { path: 'cookie-policy', component: CookiePolicyComponent },
  { path: '', redirectTo: 'privacy-policy', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    PrivacyPolicyComponent,
    TermsConditionsComponent,
    CookiePolicyComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes)
  ]
})
export class LegalModule { }
