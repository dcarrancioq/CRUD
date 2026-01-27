import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeUrl } from '@angular/platform-browser';

@Injectable({
  providedIn: 'root'
})
export class SecurityService {
  constructor(private sanitizer: DomSanitizer) {}

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.stripDangerousTags(html));
  }

  sanitizeUrl(url: string): SafeUrl {
    if (this.isValidUrl(url)) {
      return this.sanitizer.bypassSecurityTrustUrl(url);
    }
    return this.sanitizer.bypassSecurityTrustUrl('');
  }

  private stripDangerousTags(html: string): string {
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
    let sanitized = html;
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      const selfClosingRegex = new RegExp(`<${tag}[^>]*/>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    });
    sanitized = sanitized.replace(/on\w+="[^"]*"/gi, '');
    sanitized = sanitized.replace(/on\w+='[^']*'/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    return sanitized;
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url, window.location.origin);
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  encryptData(data: string, key: string): string {
    const encoded = btoa(unescape(encodeURIComponent(data)));
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(
        encoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return btoa(result);
  }

  decryptData(encryptedData: string, key: string): string {
    try {
      const decoded = atob(encryptedData);
      let result = '';
      for (let i = 0; i < decoded.length; i++) {
        result += String.fromCharCode(
          decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return decodeURIComponent(escape(atob(result)));
    } catch {
      return '';
    }
  }

  generateCsrfToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  validateCsrfToken(token: string, storedToken: string): boolean {
    if (!token || !storedToken) return false;
    return token === storedToken;
  }

  hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    return crypto.subtle.digest('SHA-256', data).then(hash => {
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    });
  }

  sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('La contrasena debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('La contrasena debe contener al menos una mayuscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('La contrasena debe contener al menos una minuscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('La contrasena debe contener al menos un numero');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('La contrasena debe contener al menos un caracter especial');
    }
    return { valid: errors.length === 0, errors };
  }
}
