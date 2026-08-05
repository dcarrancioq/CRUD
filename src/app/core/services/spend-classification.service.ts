import { Injectable } from '@angular/core';
import {
  ConsolidationOpportunity,
  CreateInvoiceLineRequest,
  Invoice,
  SpendCategory,
  SpendClassification,
  Supplier
} from '../models/invoice.model';
import { ProcurementMasterDataService } from './procurement-master-data.service';

interface CategoryScore {
  category: SpendCategory;
  score: number;
  matchedKeywords: string[];
}

@Injectable({
  providedIn: 'root'
})
export class SpendClassificationService {
  constructor(private masterData: ProcurementMasterDataService) {}

  classify(
    lines: CreateInvoiceLineRequest[],
    supplier?: Supplier,
    description?: string,
    manualCategoryCode?: string
  ): SpendClassification {
    if (manualCategoryCode) {
      const manual = this.masterData.getCategory(manualCategoryCode);
      if (manual) {
        return {
          categoryCode: manual.code,
          categoryName: manual.name,
          glAccount: manual.glAccount,
          confidence: 100,
          method: 'manual',
          matchedKeywords: []
        };
      }
    }

    const text = this.normalize([description ?? '', ...lines.map(line => `${line.description} ${line.itemCode ?? ''}`)].join(' '));
    const best = this.scoreCategories(text);

    if (best && best.score > 0) {
      const weightedByAmount = this.categoryByLineAmount(lines);
      const confidence = Math.min(95, 55 + best.score * 12 + (weightedByAmount === best.category.code ? 10 : 0));
      return {
        categoryCode: best.category.code,
        categoryName: best.category.name,
        glAccount: best.category.glAccount,
        confidence: Math.round(confidence),
        method: 'rule_keyword',
        matchedKeywords: best.matchedKeywords
      };
    }

    if (supplier?.defaultCategoryCode) {
      const fallback = this.masterData.getCategory(supplier.defaultCategoryCode);
      if (fallback) {
        return {
          categoryCode: fallback.code,
          categoryName: fallback.name,
          glAccount: fallback.glAccount,
          confidence: 55,
          method: 'supplier_default',
          matchedKeywords: []
        };
      }
    }

    const other = this.masterData.getCategory('GEN-OTHER')!;
    return {
      categoryCode: other.code,
      categoryName: other.name,
      glAccount: other.glAccount,
      confidence: 20,
      method: 'rule_keyword',
      matchedKeywords: []
    };
  }

  classifyLine(line: CreateInvoiceLineRequest, supplier?: Supplier): string {
    if (line.categoryCode) {
      return line.categoryCode;
    }
    const best = this.scoreCategories(this.normalize(`${line.description} ${line.itemCode ?? ''}`));
    if (best && best.score > 0) {
      return best.category.code;
    }
    return supplier?.defaultCategoryCode ?? 'GEN-OTHER';
  }

  findConsolidationOpportunities(invoices: Invoice[]): ConsolidationOpportunity[] {
    const byCategory = new Map<string, Invoice[]>();
    invoices.forEach(invoice => {
      const code = invoice.classification.categoryCode;
      byCategory.set(code, [...(byCategory.get(code) ?? []), invoice]);
    });

    const opportunities: ConsolidationOpportunity[] = [];
    byCategory.forEach((categoryInvoices, code) => {
      const supplierIds = Array.from(new Set(categoryInvoices.map(invoice => invoice.supplierId)));
      if (supplierIds.length < 2) {
        return;
      }
      const annualSpend = categoryInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
      const category = this.masterData.getCategory(code);
      const supplierNames = supplierIds.map(
        id => this.masterData.getSupplier(id)?.legalName ?? categoryInvoices.find(inv => inv.supplierId === id)?.supplierName ?? id
      );
      opportunities.push({
        categoryCode: code,
        categoryName: category?.name ?? code,
        supplierIds,
        supplierNames,
        invoiceCount: categoryInvoices.length,
        annualSpend,
        estimatedSavings: Math.round(annualSpend * (0.03 + 0.02 * (supplierIds.length - 1)) * 100) / 100,
        rationale: `${supplierIds.length} proveedores facturan en la categoria ${
          category?.name ?? code
        }. Unificar volumen permite negociar precio unico y condiciones de pago homogeneas.`
      });
    });

    return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  private categoryByLineAmount(lines: CreateInvoiceLineRequest[]): string | undefined {
    const totals = new Map<string, number>();
    lines.forEach(line => {
      const best = this.scoreCategories(this.normalize(`${line.description} ${line.itemCode ?? ''}`));
      const code = line.categoryCode ?? best?.category.code;
      if (!code) {
        return;
      }
      totals.set(code, (totals.get(code) ?? 0) + line.quantity * line.unitPrice);
    });
    let winner: string | undefined;
    let max = -1;
    totals.forEach((amount, code) => {
      if (amount > max) {
        max = amount;
        winner = code;
      }
    });
    return winner;
  }

  private scoreCategories(text: string): CategoryScore | undefined {
    const scores: CategoryScore[] = this.masterData
      .getCategories()
      .map(category => {
        const matchedKeywords = category.keywords.filter(keyword => text.includes(this.normalize(keyword)));
        return { category, score: matchedKeywords.length, matchedKeywords };
      })
      .sort((a, b) => b.score - a.score);
    return scores[0];
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
