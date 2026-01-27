import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  focusIndicators: boolean;
  fontSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private readonly SETTINGS_KEY = 'accessibility_settings';
  private renderer: Renderer2;

  private defaultSettings: AccessibilitySettings = {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReaderMode: false,
    focusIndicators: true,
    fontSize: 100
  };

  private settingsSubject = new BehaviorSubject<AccessibilitySettings>(this.loadSettings());
  settings$ = this.settingsSubject.asObservable();

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.applySettings(this.loadSettings());
    this.detectSystemPreferences();
  }

  private loadSettings(): AccessibilitySettings {
    const stored = localStorage.getItem(this.SETTINGS_KEY);
    if (stored) {
      try {
        return { ...this.defaultSettings, ...JSON.parse(stored) };
      } catch {
        return this.defaultSettings;
      }
    }
    return this.defaultSettings;
  }

  private saveSettings(settings: AccessibilitySettings): void {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    this.settingsSubject.next(settings);
  }

  private detectSystemPreferences(): void {
    if (window.matchMedia) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');

      if (prefersReducedMotion.matches && !this.loadSettings().reducedMotion) {
        this.toggleReducedMotion(true);
      }

      if (prefersHighContrast.matches && !this.loadSettings().highContrast) {
        this.toggleHighContrast(true);
      }
    }
  }

  applySettings(settings: AccessibilitySettings): void {
    const body = document.body;

    if (settings.highContrast) {
      this.renderer.addClass(body, 'high-contrast');
    } else {
      this.renderer.removeClass(body, 'high-contrast');
    }

    if (settings.largeText) {
      this.renderer.addClass(body, 'large-text');
    } else {
      this.renderer.removeClass(body, 'large-text');
    }

    if (settings.reducedMotion) {
      this.renderer.addClass(body, 'reduced-motion');
    } else {
      this.renderer.removeClass(body, 'reduced-motion');
    }

    if (settings.focusIndicators) {
      this.renderer.addClass(body, 'focus-visible');
    } else {
      this.renderer.removeClass(body, 'focus-visible');
    }

    if (settings.screenReaderMode) {
      this.renderer.addClass(body, 'screen-reader-mode');
    } else {
      this.renderer.removeClass(body, 'screen-reader-mode');
    }

    this.renderer.setStyle(body, 'font-size', `${settings.fontSize}%`);
  }

  toggleHighContrast(value?: boolean): void {
    const settings = this.loadSettings();
    settings.highContrast = value !== undefined ? value : !settings.highContrast;
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  toggleLargeText(value?: boolean): void {
    const settings = this.loadSettings();
    settings.largeText = value !== undefined ? value : !settings.largeText;
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  toggleReducedMotion(value?: boolean): void {
    const settings = this.loadSettings();
    settings.reducedMotion = value !== undefined ? value : !settings.reducedMotion;
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  toggleScreenReaderMode(value?: boolean): void {
    const settings = this.loadSettings();
    settings.screenReaderMode = value !== undefined ? value : !settings.screenReaderMode;
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  toggleFocusIndicators(value?: boolean): void {
    const settings = this.loadSettings();
    settings.focusIndicators = value !== undefined ? value : !settings.focusIndicators;
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  setFontSize(size: number): void {
    const settings = this.loadSettings();
    settings.fontSize = Math.max(75, Math.min(150, size));
    this.saveSettings(settings);
    this.applySettings(settings);
  }

  increaseFontSize(): void {
    const settings = this.loadSettings();
    this.setFontSize(settings.fontSize + 10);
  }

  decreaseFontSize(): void {
    const settings = this.loadSettings();
    this.setFontSize(settings.fontSize - 10);
  }

  resetSettings(): void {
    this.saveSettings(this.defaultSettings);
    this.applySettings(this.defaultSettings);
  }

  getCurrentSettings(): AccessibilitySettings {
    return this.loadSettings();
  }

  announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }

  skipToMainContent(): void {
    const main = document.querySelector('main, [role="main"], #main-content');
    if (main) {
      (main as HTMLElement).focus();
      (main as HTMLElement).scrollIntoView({ behavior: 'smooth' });
    }
  }
}
