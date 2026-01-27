import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  timestamp: Date;
  version: string;
}

export interface UserDataExport {
  personalInfo: any;
  orders: any[];
  addresses: any[];
  preferences: any;
  consentHistory: any[];
  exportDate: Date;
}

@Injectable({
  providedIn: 'root'
})
export class GdprService {
  private readonly CONSENT_KEY = 'cookie_consent';
  private readonly CONSENT_VERSION = '1.0';
  private readonly API_URL = `${environment.apiUrl}/gdpr`;

  private consentSubject = new BehaviorSubject<CookieConsent | null>(this.getStoredConsent());
  consent$ = this.consentSubject.asObservable();

  constructor(private http: HttpClient) {}

  hasConsent(): boolean {
    return this.getStoredConsent() !== null;
  }

  getStoredConsent(): CookieConsent | null {
    const stored = localStorage.getItem(this.CONSENT_KEY);
    if (!stored) return null;
    try {
      const consent = JSON.parse(stored);
      if (consent.version !== this.CONSENT_VERSION) {
        return null;
      }
      return consent;
    } catch {
      return null;
    }
  }

  saveConsent(consent: Partial<CookieConsent>): void {
    const fullConsent: CookieConsent = {
      necessary: true,
      analytics: consent.analytics || false,
      marketing: consent.marketing || false,
      preferences: consent.preferences || false,
      timestamp: new Date(),
      version: this.CONSENT_VERSION
    };
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(fullConsent));
    this.consentSubject.next(fullConsent);
    this.logConsent(fullConsent);
  }

  acceptAll(): void {
    this.saveConsent({
      analytics: true,
      marketing: true,
      preferences: true
    });
  }

  rejectAll(): void {
    this.saveConsent({
      analytics: false,
      marketing: false,
      preferences: false
    });
  }

  revokeConsent(): void {
    localStorage.removeItem(this.CONSENT_KEY);
    this.consentSubject.next(null);
  }

  private logConsent(consent: CookieConsent): void {
    this.http.post(`${this.API_URL}/consent-log`, consent).subscribe({
      error: () => {}
    });
  }

  canUseAnalytics(): boolean {
    const consent = this.getStoredConsent();
    return consent?.analytics || false;
  }

  canUseMarketing(): boolean {
    const consent = this.getStoredConsent();
    return consent?.marketing || false;
  }

  canUsePreferences(): boolean {
    const consent = this.getStoredConsent();
    return consent?.preferences || false;
  }

  requestDataExport(): Observable<UserDataExport> {
    return this.http.get<UserDataExport>(`${this.API_URL}/export-data`);
  }

  requestDataDeletion(): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.API_URL}/delete-data`);
  }

  getConsentHistory(): Observable<CookieConsent[]> {
    return this.http.get<CookieConsent[]>(`${this.API_URL}/consent-history`);
  }

  downloadDataAsJson(data: UserDataExport): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-datos-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
