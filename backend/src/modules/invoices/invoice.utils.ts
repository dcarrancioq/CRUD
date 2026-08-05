export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function normalizeText(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeInvoiceNumber(value: string): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizeIban(value: string): string {
  return (value ?? '').toUpperCase().replace(/\s/g, '');
}

export function maskIban(iban: string): string {
  const clean = normalizeIban(iban);
  return clean.length > 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : clean;
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const first = new Date(a).getTime();
  const second = new Date(b).getTime();
  return Math.round(Math.abs(second - first) / (1000 * 60 * 60 * 24));
}

export function formatAmount(value: number, currency: string): string {
  return `${value.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export function formatDate(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
