import { Component } from '@angular/core';
import { GdprService } from '../../../../core/services/gdpr.service';

@Component({
  selector: 'app-cookie-policy',
  templateUrl: './cookie-policy.component.html',
  styleUrls: ['./cookie-policy.component.css']
})
export class CookiePolicyComponent {
  lastUpdated = new Date('2026-01-27');

  constructor(private gdprService: GdprService) {}

  openCookieSettings(): void {
    this.gdprService.revokeConsent();
    window.location.reload();
  }
}
