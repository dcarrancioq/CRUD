import { Injectable } from '@nestjs/common';
import { Supplier } from '../../master-data/entities/supplier.entity';
import { MasterDataService } from '../../master-data/master-data.service';
import {
  ExtractedFieldInfo,
  ImportedInvoiceDraft,
  ImportedInvoiceLine,
  ImportedSupplierMatch,
  InvoiceImportResult,
} from '../invoice-import.types';
import { normalizeIban, normalizeText, round } from '../invoice.utils';
import { InvoiceDocumentService, ParsedDocument } from './invoice-document.service';

interface LabelHit {
  value: string;
  source: string;
}

const LABELS = {
  invoiceNumber: [
    'numero de factura',
    'num. factura',
    'num factura',
    'n. de factura',
    'n de factura',
    'n. factura',
    'no de factura',
    'no factura',
    'factura numero',
    'factura no',
    'invoice number',
    'invoice no',
    'invoice #',
  ],
  issueDate: ['fecha de emision', 'fecha emision', 'fecha de factura', 'fecha factura', 'invoice date', 'issue date'],
  dueDate: ['fecha de vencimiento', 'vencimiento', 'due date', 'payment due'],
  receivedDate: ['fecha de recepcion', 'fecha recepcion', 'received date'],
  taxId: ['nif', 'cif', 'n.i.f', 'c.i.f', 'vat number', 'vat id', 'tax id'],
  supplierName: ['proveedor', 'emisor', 'razon social', 'supplier', 'vendor'],
  purchaseOrder: ['pedido de compra', 'orden de compra', 'num. pedido', 'num pedido', 'pedido', 'purchase order', 'po number'],
  contract: ['contrato', 'referencia de contrato', 'contract reference', 'contract'],
  iban: ['iban', 'cuenta bancaria', 'cuenta de abono', 'bank account'],
  accountHolder: ['titular de la cuenta', 'titular', 'beneficiario', 'account holder'],
  costCenter: ['centro de coste', 'cost center', 'cost centre'],
  paymentTerms: ['condiciones de pago', 'plazo de pago', 'payment terms', 'terminos de pago'],
  subtotal: ['base imponible', 'subtotal', 'importe neto', 'net amount', 'taxable base'],
  taxAmount: ['cuota iva', 'importe iva', 'total iva', 'impuestos', 'tax amount', 'vat amount', 'iva'],
  total: ['total factura', 'importe total', 'total a pagar', 'total amount', 'amount due', 'total'],
  taxRate: ['tipo impositivo', 'tipo de iva', 'iva', 'vat rate', 'tax rate'],
  description: ['concepto', 'descripcion del servicio', 'asunto', 'subject'],
};

const CURRENCY_BY_SYMBOL: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP' };
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const REQUIRED_FIELDS: { field: keyof ImportedInvoiceDraft; label: string }[] = [
  { field: 'invoiceNumber', label: 'Numero de factura' },
  { field: 'issueDate', label: 'Fecha de emision' },
  { field: 'dueDate', label: 'Vencimiento' },
  { field: 'bankAccountIban', label: 'IBAN de cobro' },
  { field: 'declaredTotalAmount', label: 'Total declarado' },
];

/**
 * Extraccion determinista de los campos de factura a partir del texto del documento.
 * El resultado es una propuesta: la pantalla de alta la muestra para que una persona
 * la revise y corrija antes de registrar la factura.
 */
@Injectable()
export class InvoiceExtractionService {
  constructor(
    private readonly documents: InvoiceDocumentService,
    private readonly masterData: MasterDataService,
  ) {}

  async extract(fileName: string, buffer: Buffer): Promise<InvoiceImportResult> {
    const document = await this.documents.parse(fileName, buffer);
    const lines = document.text.split('\n');
    const flatLines = lines.map((line) => this.flatten(line));
    const fields: ExtractedFieldInfo[] = [];
    const warnings: string[] = [];
    const draft: ImportedInvoiceDraft = { lines: [] };

    const invoiceNumber = this.label(flatLines, LABELS.invoiceNumber);
    if (invoiceNumber) {
      const token = invoiceNumber.value.match(/[A-Za-z0-9][A-Za-z0-9/\-_.]{2,}/);
      if (token) {
        draft.invoiceNumber = token[0].toUpperCase();
        this.push(fields, 'invoiceNumber', 'Numero de factura', draft.invoiceNumber, 0.92, invoiceNumber.source);
      }
    }

    const issueDate = this.dateFrom(this.label(flatLines, LABELS.issueDate));
    if (issueDate) {
      draft.issueDate = issueDate.value;
      this.push(fields, 'issueDate', 'Fecha de emision', issueDate.value, 0.9, issueDate.source);
    }

    const dueDate = this.dateFrom(this.label(flatLines, LABELS.dueDate));
    if (dueDate) {
      draft.dueDate = dueDate.value;
      this.push(fields, 'dueDate', 'Vencimiento', dueDate.value, 0.9, dueDate.source);
    }

    const receivedDate = this.dateFrom(this.label(flatLines, LABELS.receivedDate));
    draft.receivedDate = receivedDate?.value ?? new Date().toISOString().slice(0, 10);
    this.push(
      fields,
      'receivedDate',
      'Fecha de recepcion',
      draft.receivedDate,
      receivedDate ? 0.9 : 0.5,
      receivedDate?.source ?? 'Fecha de importacion del documento',
    );

    const purchaseOrder = this.label(flatLines, LABELS.purchaseOrder);
    const poToken = purchaseOrder?.value.match(/[A-Za-z0-9][A-Za-z0-9/\-_.]{2,}/);
    if (poToken) {
      draft.purchaseOrderNumber = poToken[0].toUpperCase();
      this.push(fields, 'purchaseOrderNumber', 'Pedido de compra', draft.purchaseOrderNumber, 0.85, purchaseOrder!.source);
    }

    const contract = this.label(flatLines, LABELS.contract);
    const contractToken = contract?.value.match(/[A-Za-z0-9][A-Za-z0-9/\-_.]{2,}/);
    if (contractToken) {
      draft.contractReference = contractToken[0].toUpperCase();
      this.push(fields, 'contractReference', 'Contrato', draft.contractReference, 0.8, contract!.source);
    }

    const iban = this.ibanFrom(flatLines);
    if (iban) {
      draft.bankAccountIban = iban.value;
      this.push(fields, 'bankAccountIban', 'IBAN de cobro', iban.value, 0.9, iban.source);
    }

    const holder = this.label(flatLines, LABELS.accountHolder);
    if (holder && holder.value.length > 2) {
      draft.bankAccountHolder = this.cleanName(holder.value);
      this.push(fields, 'bankAccountHolder', 'Titular de la cuenta', draft.bankAccountHolder, 0.8, holder.source);
    }

    const costCenter = this.label(flatLines, LABELS.costCenter);
    const costCenterToken = costCenter?.value.match(/[A-Za-z0-9][A-Za-z0-9/\-_.]{2,}/);
    if (costCenterToken) {
      draft.costCenter = costCenterToken[0].toUpperCase();
      this.push(fields, 'costCenter', 'Centro de coste', draft.costCenter, 0.8, costCenter!.source);
    }

    const currency = this.currencyFrom(document.text);
    if (currency) {
      draft.currency = currency.value;
      this.push(fields, 'currency', 'Divisa', currency.value, 0.75, currency.source);
    }

    const taxRate = this.taxRateFrom(flatLines);
    if (taxRate !== undefined) {
      draft.taxRate = taxRate.value;
      this.push(fields, 'taxRate', 'Tipo de IVA', `${taxRate.value}%`, 0.85, taxRate.source);
    }

    const subtotal = this.amountFrom(flatLines, LABELS.subtotal);
    if (subtotal) {
      draft.declaredSubtotal = subtotal.value;
      this.push(fields, 'declaredSubtotal', 'Base imponible declarada', this.money(subtotal.value), 0.9, subtotal.source);
    }

    const taxAmount = this.amountFrom(flatLines, LABELS.taxAmount);
    if (taxAmount) {
      draft.declaredTaxAmount = taxAmount.value;
      this.push(fields, 'declaredTaxAmount', 'IVA declarado', this.money(taxAmount.value), 0.9, taxAmount.source);
    }

    const total = this.amountFrom(flatLines, LABELS.total);
    if (total) {
      draft.declaredTotalAmount = total.value;
      this.push(fields, 'declaredTotalAmount', 'Total declarado', this.money(total.value), 0.9, total.source);
    }

    const description = this.label(flatLines, LABELS.description);
    if (description && description.value.length > 3) {
      draft.description = description.value.slice(0, 200);
      this.push(fields, 'description', 'Concepto', draft.description, 0.7, description.source);
    }

    const paymentTerms = this.paymentTermsFrom(flatLines, draft);
    if (paymentTerms) {
      draft.paymentTermsDays = paymentTerms.value;
      this.push(fields, 'paymentTermsDays', 'Plazo de pago (dias)', `${paymentTerms.value}`, paymentTerms.confidence, paymentTerms.source);
    }

    draft.lines = this.extractLines(document, lines, flatLines, draft);
    if (draft.lines.length) {
      this.push(
        fields,
        'lines',
        'Lineas de factura',
        `${draft.lines.length} linea(s) por ${this.money(
          draft.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        )}`,
        draft.lines.length > 1 ? 0.8 : 0.6,
        'Tabla de detalle del documento',
      );
    }

    const supplierMatch = await this.matchSupplier(flatLines, document.text, draft, warnings);
    if (supplierMatch) {
      draft.supplierId = supplierMatch.supplierId;
      this.push(
        fields,
        'supplierId',
        'Proveedor',
        supplierMatch.legalName,
        supplierMatch.confidence,
        `Coincidencia por ${this.matchLabel(supplierMatch.matchedBy)}`,
      );
    } else if (!warnings.some((warning) => warning.includes('maestro de proveedores'))) {
      warnings.push('No se ha identificado el proveedor en el maestro: seleccionalo manualmente.');
    }

    this.crossCheck(draft, warnings);

    const missingFields = REQUIRED_FIELDS.filter(({ field }) => draft[field] === undefined).map(
      ({ label }) => label,
    );
    if (!draft.lines.length) {
      missingFields.push('Lineas de factura');
    }

    return {
      fileName,
      format: document.format,
      draft,
      fields,
      supplierMatch,
      warnings,
      missingFields,
      textPreview: lines.slice(0, 40).join('\n'),
    };
  }

  private crossCheck(draft: ImportedInvoiceDraft, warnings: string[]): void {
    const linesTotal = round(draft.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    if (draft.declaredSubtotal !== undefined && linesTotal > 0) {
      if (Math.abs(linesTotal - draft.declaredSubtotal) > 1) {
        warnings.push(
          `Las lineas suman ${this.money(linesTotal)} y la base imponible declarada es ${this.money(
            draft.declaredSubtotal,
          )}: revisa el detalle antes de registrar.`,
        );
      }
    }
    if (
      draft.declaredSubtotal !== undefined &&
      draft.declaredTaxAmount !== undefined &&
      draft.declaredTotalAmount !== undefined &&
      Math.abs(draft.declaredSubtotal + draft.declaredTaxAmount - draft.declaredTotalAmount) > 1
    ) {
      warnings.push('Base imponible + IVA no cuadra con el total declarado en el documento.');
    }
    if (draft.issueDate && draft.dueDate && draft.dueDate < draft.issueDate) {
      warnings.push('El vencimiento leido es anterior a la fecha de emision: revisa las fechas.');
    }
  }

  private async matchSupplier(
    flatLines: string[],
    text: string,
    draft: ImportedInvoiceDraft,
    warnings: string[],
  ): Promise<ImportedSupplierMatch | undefined> {
    const suppliers = await this.masterData.findSuppliers();
    if (!suppliers.length) {
      return undefined;
    }

    const taxId = this.taxIdFrom(flatLines, text);
    if (taxId) {
      const byTaxId = suppliers.find(
        (supplier) => this.compactTaxId(supplier.taxId) === this.compactTaxId(taxId),
      );
      if (byTaxId) {
        return this.toMatch(byTaxId, 'taxId', 0.98);
      }
    }

    if (draft.bankAccountIban) {
      const iban = normalizeIban(draft.bankAccountIban);
      const byIban = suppliers.find((supplier) =>
        (supplier.bankAccounts ?? []).some((account) => normalizeIban(account.iban) === iban),
      );
      if (byIban) {
        return this.toMatch(byIban, 'iban', 0.9);
      }
    }

    // El documento identifica a su emisor por NIF: si ese NIF no esta dado de alta,
    // buscar por nombre solo produciria falsos positivos (el nombre de otro proveedor
    // puede aparecer en el detalle de la factura).
    if (taxId) {
      warnings.push(
        `El NIF/CIF ${taxId.toUpperCase()} del documento no esta en el maestro de proveedores: selecciona el proveedor manualmente o dalo de alta.`,
      );
      return undefined;
    }

    const haystack = normalizeText(text);
    const byName = suppliers
      .map((supplier) => ({ supplier, score: this.nameScore(haystack, supplier.legalName) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)[0];
    // Solo se acepta la razon social completa: coincidencias parciales de tokens
    // ('Nimbus' dentro de una linea de detalle) no identifican al emisor.
    if (byName && byName.score >= 1) {
      return this.toMatch(byName.supplier, 'name', 0.85);
    }
    return undefined;
  }

  private nameScore(haystack: string, legalName: string): number {
    const normalized = normalizeText(legalName);
    if (normalized.length > 3 && haystack.includes(normalized)) {
      return 1;
    }
    const tokens = normalized
      .replace(/\b(s\.?l\.?u?|s\.?a\.?|sociedad|limitada|iberia|espana)\b/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3);
    if (!tokens.length) {
      return 0;
    }
    const hits = tokens.filter((token) => haystack.includes(token)).length;
    return hits / tokens.length;
  }

  private toMatch(supplier: Supplier, matchedBy: ImportedSupplierMatch['matchedBy'], confidence: number): ImportedSupplierMatch {
    return {
      supplierId: supplier.id,
      legalName: supplier.legalName,
      taxId: supplier.taxId,
      matchedBy,
      confidence,
    };
  }

  private matchLabel(matchedBy: ImportedSupplierMatch['matchedBy']): string {
    return matchedBy === 'taxId' ? 'NIF/CIF' : matchedBy === 'iban' ? 'IBAN' : 'razon social';
  }

  private extractLines(
    document: ParsedDocument,
    lines: string[],
    flatLines: string[],
    draft: ImportedInvoiceDraft,
  ): ImportedInvoiceLine[] {
    const fromRows = document.rows.length ? this.linesFromRows(document.rows, draft) : [];
    if (fromRows.length) {
      return fromRows;
    }
    const fromText = this.linesFromText(lines, flatLines, draft);
    if (fromText.length) {
      return fromText;
    }
    // Sin tabla legible: una unica linea con el concepto y la base imponible leidos.
    const amount = draft.declaredSubtotal ?? draft.declaredTotalAmount;
    if (amount === undefined) {
      return [];
    }
    return [
      {
        description: draft.description ?? 'Servicios facturados',
        quantity: 1,
        uom: 'servicio',
        unitPrice: amount,
        taxRate: draft.taxRate ?? 21,
      },
    ];
  }

  private linesFromRows(rows: string[][], draft: ImportedInvoiceDraft): ImportedInvoiceLine[] {
    const headerIndex = rows.findIndex((row) => this.isLineHeader(row.map((cell) => this.flatten(cell).toLowerCase())));
    if (headerIndex === -1) {
      return [];
    }
    const header = rows[headerIndex].map((cell) => this.flatten(cell).toLowerCase());
    const columns = {
      description: header.findIndex((cell) => /descripcion|concepto|description|detalle/.test(cell)),
      quantity: header.findIndex((cell) => /cantidad|uds|unidades|qty|quantity/.test(cell)),
      uom: header.findIndex((cell) => /unidad de medida|u\.m|uom|medida/.test(cell)),
      unitPrice: header.findIndex((cell) => /precio|importe unitario|unit price|p\.?\s?unit/.test(cell)),
      taxRate: header.findIndex((cell) => /iva|vat|impuesto|tax/.test(cell)),
    };

    const result: ImportedInvoiceLine[] = [];
    for (const row of rows.slice(headerIndex + 1)) {
      const description = columns.description >= 0 ? row[columns.description]?.trim() : '';
      if (!description || /^(total|base imponible|subtotal)/i.test(description)) {
        continue;
      }
      const quantity = this.number(columns.quantity >= 0 ? row[columns.quantity] : '') ?? 1;
      const unitPrice = this.number(columns.unitPrice >= 0 ? row[columns.unitPrice] : '');
      if (unitPrice === undefined) {
        continue;
      }
      result.push({
        description: description.slice(0, 200),
        quantity,
        uom: (columns.uom >= 0 ? row[columns.uom]?.trim() : '') || 'unidad',
        unitPrice,
        taxRate: this.number(columns.taxRate >= 0 ? row[columns.taxRate] : '') ?? draft.taxRate ?? 21,
      });
    }
    return result;
  }

  private linesFromText(lines: string[], flatLines: string[], draft: ImportedInvoiceDraft): ImportedInvoiceLine[] {
    const headerIndex = flatLines.findIndex((line) => this.isLineHeader([line.toLowerCase()]));
    if (headerIndex === -1) {
      return [];
    }
    const result: ImportedInvoiceLine[] = [];
    // En un PDF la descripcion puede ocupar varias lineas antes de la fila con importes.
    let pending = '';
    for (const raw of lines.slice(headerIndex + 1)) {
      const line = this.flatten(raw);
      if (/^(total|base imponible|subtotal|iva|impuestos|condiciones|notas|observaciones|forma de pago)\b/i.test(line)) {
        break;
      }
      if (!line) {
        continue;
      }
      const parsed = this.parseAmountRow(line, pending, draft) ?? this.parseLineRow(line, draft);
      if (parsed) {
        result.push(parsed);
        pending = '';
      } else {
        pending = `${pending} ${line}`.trim().slice(-200);
      }
    }
    return result;
  }

  /**
   * Fila que termina en `cantidad precio importe`, con o sin divisa intercalada.
   * Se acepta solo si `cantidad x precio` cuadra con el importe de la fila, que es
   * la comprobacion que evita confundir codigos o periodos con cifras de la linea.
   */
  private parseAmountRow(
    line: string,
    pending: string,
    draft: ImportedInvoiceDraft,
  ): ImportedInvoiceLine | undefined {
    const match = line.match(
      /^(.*?)\s*(\d[\d.,]*)\s+(\d[\d.,]*)\s*(?:EUR|USD|GBP|€|\$|£)?\s+(\d[\d.,]*)\s*(?:EUR|USD|GBP|€|\$|£)?$/i,
    );
    if (!match) {
      return undefined;
    }
    const quantity = this.number(match[2]);
    const unitPrice = this.number(match[3]);
    const amount = this.number(match[4]);
    if (quantity === undefined || unitPrice === undefined || amount === undefined || quantity <= 0) {
      return undefined;
    }
    if (Math.abs(quantity * unitPrice - amount) > 0.05) {
      return undefined;
    }
    const description = `${pending} ${match[1]}`.replace(/\s{2,}/g, ' ').trim();
    if (description.length < 3) {
      return undefined;
    }
    return {
      description: description.slice(0, 200),
      quantity,
      uom: 'unidad',
      unitPrice,
      taxRate: draft.taxRate ?? 21,
    };
  }

  private parseLineRow(line: string, draft: ImportedInvoiceDraft): ImportedInvoiceLine | undefined {
    const cells = line.includes('|') ? line.split('|').map((cell) => cell.trim()) : undefined;
    if (cells && cells.length >= 3) {
      const numbers = cells.map((cell) => this.number(cell));
      const description = cells
        .filter((cell, index) => numbers[index] === undefined && cell.length > 2)
        .sort((a, b) => b.length - a.length)[0];
      const texts = cells.filter((cell, index) => numbers[index] === undefined && cell.length > 0);
      const numeric = numbers.filter((value): value is number => value !== undefined);
      if (description && numeric.length >= 2) {
        return {
          description: description.slice(0, 200),
          quantity: numeric[0],
          uom: texts.find((cell) => cell !== description) ?? 'unidad',
          unitPrice: numeric[1],
          taxRate: draft.taxRate ?? 21,
        };
      }
      return undefined;
    }

    const match = line.match(
      /^(.+?)\s+(\d[\d.,]*)\s+([A-Za-z/º.]+)?\s*(\d[\d.,]*)\s*(?:(\d{1,2}(?:[.,]\d+)?)\s*%)?\s*(\d[\d.,]*)?$/,
    );
    if (!match) {
      return undefined;
    }
    const description = match[1].trim();
    const quantity = this.number(match[2]);
    const unitPrice = this.number(match[4]);
    if (
      !description ||
      description.length < 3 ||
      quantity === undefined ||
      unitPrice === undefined ||
      quantity <= 0 ||
      unitPrice <= 0
    ) {
      return undefined;
    }
    return {
      description: description.slice(0, 200),
      quantity,
      uom: (match[3] ?? 'unidad').trim() || 'unidad',
      unitPrice,
      taxRate: this.number(match[5] ?? '') ?? draft.taxRate ?? 21,
    };
  }

  private isLineHeader(cells: string[]): boolean {
    const joined = cells.join(' ');
    return (
      /descripcion|concepto|description|detalle/.test(joined) &&
      /cantidad|cant\.?\b|uds|unidades|qty|quantity/.test(joined) &&
      /precio|importe|unit price|total/.test(joined)
    );
  }

  private label(flatLines: string[], labels: string[]): LabelHit | undefined {
    for (const label of labels) {
      for (let index = 0; index < flatLines.length; index += 1) {
        const line = flatLines[index];
        const hit = this.labelPosition(line, label);
        if (!hit) {
          continue;
        }
        let rest = line.slice(hit.end).replace(/^[\s:.\-|#º°>]+/, '').trim();
        if (!rest && flatLines[index + 1]) {
          rest = flatLines[index + 1].replace(/^[\s:.\-|#>]+/, '').trim();
        }
        if (rest) {
          return { value: rest, source: line };
        }
      }
    }
    return undefined;
  }

  /**
   * Localiza la etiqueta exigiendo que empiece en palabra (asi "Total" no casa
   * dentro de "Subtotal") y tolerando los separadores que mete cada maquetacion
   * entre sus palabras: `N.o de factura`, `Num . factura`, `Fecha  emision`.
   */
  private labelPosition(line: string, label: string): { end: number } | undefined {
    const parts = label.split(/[\s.]+/).filter(Boolean).map((part) => this.escape(part));
    if (!parts.length) {
      return undefined;
    }
    const pattern = new RegExp(`(?:^|[^a-z0-9])(${parts.join('[\\s.º°]*')})`, 'i');
    const match = pattern.exec(line);
    return match ? { end: match.index + match[0].length } : undefined;
  }

  private dateFrom(hit: LabelHit | undefined): LabelHit | undefined {
    if (!hit) {
      return undefined;
    }
    const iso = this.parseDate(hit.value);
    return iso ? { value: iso, source: hit.source } : undefined;
  }

  private parseDate(raw: string): string | undefined {
    const isoMatch = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      return this.toIso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }
    const dmy = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (dmy) {
      const year = Number(dmy[3]) < 100 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
      return this.toIso(year, Number(dmy[2]), Number(dmy[1]));
    }
    const spelled = raw.toLowerCase().match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
    if (spelled) {
      const month = MONTHS.indexOf(spelled[2]) + 1;
      if (month > 0) {
        return this.toIso(Number(spelled[3]), month, Number(spelled[1]));
      }
    }
    return undefined;
  }

  private toIso(year: number, month: number, day: number): string | undefined {
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return undefined;
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private amountFrom(flatLines: string[], labels: string[]): { value: number; source: string } | undefined {
    const hit = this.label(flatLines, labels);
    if (!hit) {
      return undefined;
    }
    const candidates = hit.value.match(/-?\d[\d.,]*/g) ?? [];
    for (const candidate of candidates) {
      // Un porcentaje pegado al importe (IVA 21% 1.234,00) no es el importe buscado.
      if (new RegExp(`${this.escape(candidate)}\\s*%`).test(hit.value)) {
        continue;
      }
      const value = this.number(candidate);
      if (value !== undefined) {
        return { value, source: hit.source };
      }
    }
    return undefined;
  }

  private taxRateFrom(flatLines: string[]): { value: number; source: string } | undefined {
    const hit = this.label(flatLines, LABELS.taxRate);
    const percent = hit?.value.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/) ?? undefined;
    if (hit && percent) {
      return { value: this.number(percent[1]) ?? 21, source: hit.source };
    }
    for (const line of flatLines) {
      const match = line.match(/\biva\b[^\d%]{0,10}(\d{1,2}(?:[.,]\d+)?)\s*%/i);
      if (match) {
        return { value: this.number(match[1]) ?? 21, source: line };
      }
    }
    return undefined;
  }

  private ibanFrom(flatLines: string[]): { value: string; source: string } | undefined {
    const pattern = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){3,7}(?:[ ]?[A-Z0-9]{1,4})?\b/i;
    for (let index = 0; index < flatLines.length; index += 1) {
      const line = flatLines[index];
      if (!pattern.test(line)) {
        continue;
      }
      // Al extraer el texto de un PDF el IBAN puede partirse en varias lineas:
      // se anaden las siguientes y se conserva la lectura mas larga (max 34).
      let best = '';
      let candidate = line;
      for (let offset = 1; offset <= 2; offset += 1) {
        const match = candidate.match(pattern);
        const iban = match ? normalizeIban(match[0]) : '';
        if (iban.length > best.length && iban.length <= 34) {
          best = iban;
        }
        const next = flatLines[index + offset];
        if (!next || !/^[A-Z0-9]{1,4}\b/i.test(next)) {
          break;
        }
        candidate = `${candidate} ${next}`;
      }
      if (best.length >= 20) {
        return { value: best, source: line };
      }
    }
    return undefined;
  }

  private taxIdFrom(flatLines: string[], text: string): string | undefined {
    // La primera linea que menciona el NIF puede ser un texto corrido sin el numero,
    // asi que se revisan todas las que lo citan antes de recurrir al patron generico.
    for (const line of flatLines) {
      if (!/\b(nif|cif|n\.i\.f|c\.i\.f|vat|tax id)\b/i.test(line)) {
        continue;
      }
      const labelled = line.match(/\b[A-Z][-\s]?\d{7,8}[-\s]?[A-Z]?\b|\b\d{8}[-\s]?[A-Z]\b/i);
      if (labelled) {
        return labelled[0];
      }
    }
    const generic = this.flatten(text).match(/\b(?:[A-Z]\d{8}|\d{8}[A-Z]|[A-Z]\d{7}[A-Z])\b/);
    return generic?.[0];
  }

  private currencyFrom(text: string): { value: string; source: string } | undefined {
    const code = text.match(/\b(EUR|USD|GBP)\b/);
    if (code) {
      return { value: code[1], source: `Codigo ${code[1]} en el documento` };
    }
    for (const [symbol, currency] of Object.entries(CURRENCY_BY_SYMBOL)) {
      if (text.includes(symbol)) {
        return { value: currency, source: `Simbolo ${symbol} en el documento` };
      }
    }
    return undefined;
  }

  private paymentTermsFrom(
    flatLines: string[],
    draft: ImportedInvoiceDraft,
  ): { value: number; source: string; confidence: number } | undefined {
    const hit = this.label(flatLines, LABELS.paymentTerms);
    const days = hit?.value.match(/(\d{1,3})\s*(?:dias|days)?/i);
    if (hit && days) {
      return { value: Number(days[1]), source: hit.source, confidence: 0.85 };
    }
    if (draft.issueDate && draft.dueDate) {
      const diff = Math.round(
        (new Date(draft.dueDate).getTime() - new Date(draft.issueDate).getTime()) / 86400000,
      );
      if (diff >= 0) {
        return { value: diff, source: 'Diferencia entre emision y vencimiento', confidence: 0.6 };
      }
    }
    return undefined;
  }

  private number(raw: string | undefined): number | undefined {
    if (raw === undefined || raw === null) {
      return undefined;
    }
    // Solo se acepta una celda/token que sea un numero: "10TB" o "24x7" no lo son.
    const cleaned = String(raw).replace(/[\s€$£%]/g, '').trim();
    if (!/^-?\d[\d.,]*$/.test(cleaned)) {
      return undefined;
    }
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    let normalized = cleaned;
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma) {
      normalized = cleaned.replace(/,/g, '');
    } else if (lastComma !== -1) {
      normalized = cleaned.replace(',', '.');
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? round(value) : undefined;
  }

  /** Quita acentos y colapsa espacios manteniendo la posicion de cada caracter buscable. */
  private flatten(value: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private compactTaxId(value: string): string {
    return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private cleanName(value: string): string {
    return value.split('|')[0].replace(/\s{2,}/g, ' ').trim().slice(0, 120);
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private money(value: number): string {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private push(
    fields: ExtractedFieldInfo[],
    field: string,
    label: string,
    value: string,
    confidence: number,
    source: string,
  ): void {
    fields.push({ field, label, value, confidence: round(confidence), source });
  }
}
