import { Component, OnInit } from '@angular/core';
import { GdprService, CookieConsent } from '../../../core/services/gdpr.service';

@Component({
  selector: 'app-cookie-consent',
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.css']
})
export class CookieConsentComponent implements OnInit {
  showBanner = false;
  showDetails = false;

  consent: Partial<CookieConsent> = {
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false
  };

  constructor(private gdprService: GdprService) {}

  ngOnInit(): void {
    this.showBanner = !this.gdprService.hasConsent();
  }

  acceptAll(): void {
    this.gdprService.acceptAll();
    this.showBanner = false;
  }

  rejectAll(): void {
    this.gdprService.rejectAll();
    this.showBanner = false;
  }

  savePreferences(): void {
    this.gdprService.saveConsent(this.consent);
    this.showBanner = false;
    this.showDetails = false;
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }

  openSettings(): void {
    this.showBanner = true;
    this.showDetails = true;
    const storedConsent = this.gdprService.getStoredConsent();
    if (storedConsent) {
      this.consent = { ...storedConsent };
    }
  }
}
