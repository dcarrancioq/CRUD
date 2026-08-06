export type ImportedFileFormat = 'pdf' | 'word' | 'excel';

export interface ImportedInvoiceLine {
  description: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  taxRate: number;
}

/** Cabecera propuesta al operador: solo campos que el documento permite deducir. */
export interface ImportedInvoiceDraft {
  invoiceNumber?: string;
  supplierId?: string;
  purchaseOrderNumber?: string;
  contractReference?: string;
  issueDate?: string;
  receivedDate?: string;
  dueDate?: string;
  currency?: string;
  taxRate?: number;
  paymentTermsDays?: number;
  bankAccountIban?: string;
  bankAccountHolder?: string;
  costCenter?: string;
  description?: string;
  declaredSubtotal?: number;
  declaredTaxAmount?: number;
  declaredTotalAmount?: number;
  lines: ImportedInvoiceLine[];
}

export interface ExtractedFieldInfo {
  field: string;
  label: string;
  value: string;
  confidence: number;
  source: string;
}

export interface ImportedSupplierMatch {
  supplierId: string;
  legalName: string;
  taxId: string;
  matchedBy: 'taxId' | 'iban' | 'name';
  confidence: number;
}

/**
 * Datos del emisor leidos del documento cuando no esta en el maestro: sirven
 * para prerellenar el alta de proveedor que se ofrece al operador.
 */
export interface ImportedSupplierCandidate {
  taxId?: string;
  legalName?: string;
  country?: string;
  contactEmail?: string;
  iban?: string;
  holderName?: string;
  paymentTermsDays?: number;
}

export interface InvoiceImportResult {
  fileName: string;
  format: ImportedFileFormat;
  draft: ImportedInvoiceDraft;
  fields: ExtractedFieldInfo[];
  supplierMatch?: ImportedSupplierMatch;
  supplierCandidate?: ImportedSupplierCandidate;
  warnings: string[];
  missingFields: string[];
  textPreview: string;
}
