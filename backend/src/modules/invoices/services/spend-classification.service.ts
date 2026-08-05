import { Injectable } from '@nestjs/common';
import { SpendCategory } from '../../master-data/entities/spend-category.entity';
import { Supplier } from '../../master-data/entities/supplier.entity';
import { CreateInvoiceLineDto } from '../dto/create-invoice-line.dto';
import { Invoice } from '../entities/invoice.entity';
import { ConsolidationOpportunity, SpendClassificationResult } from '../invoice.types';
import { normalizeText, round } from '../invoice.utils';

interface CategoryScore {
  category: SpendCategory;
  score: number;
  matchedKeywords: string[];
}

export const FALLBACK_CATEGORY_CODE = 'GEN-OTHER';

@Injectable()
export class SpendClassificationService {
  classify(
    categories: SpendCategory[],
    lines: CreateInvoiceLineDto[],
    supplier?: Supplier | null,
    description?: string,
    manualCategoryCode?: string,
  ): SpendClassificationResult {
    if (manualCategoryCode) {
      const manual = categories.find((category) => category.code === manualCategoryCode);
      if (manual) {
        return {
          categoryCode: manual.code,
          categoryName: manual.name,
          glAccount: manual.glAccount,
          confidence: 100,
          method: 'manual',
          matchedKeywords: [],
        };
      }
    }

    const text = normalizeText(
      [description ?? '', ...lines.map((line) => `${line.description} ${line.itemCode ?? ''}`)].join(' '),
    );
    const best = this.scoreCategories(categories, text);

    if (best && best.score > 0) {
      const weightedByAmount = this.categoryByLineAmount(categories, lines);
      const confidence = Math.min(
        95,
        55 + best.score * 12 + (weightedByAmount === best.category.code ? 10 : 0),
      );
      return {
        categoryCode: best.category.code,
        categoryName: best.category.name,
        glAccount: best.category.glAccount,
        confidence: Math.round(confidence),
        method: 'rule_keyword',
        matchedKeywords: best.matchedKeywords,
      };
    }

    if (supplier?.defaultCategoryCode) {
      const fallback = categories.find((category) => category.code === supplier.defaultCategoryCode);
      if (fallback) {
        return {
          categoryCode: fallback.code,
          categoryName: fallback.name,
          glAccount: fallback.glAccount,
          confidence: 55,
          method: 'supplier_default',
          matchedKeywords: [],
        };
      }
    }

    const other = categories.find((category) => category.code === FALLBACK_CATEGORY_CODE);
    return {
      categoryCode: other?.code ?? FALLBACK_CATEGORY_CODE,
      categoryName: other?.name ?? 'Otros gastos no clasificados',
      glAccount: other?.glAccount ?? '629900',
      confidence: 20,
      method: 'rule_keyword',
      matchedKeywords: [],
    };
  }

  classifyLine(
    categories: SpendCategory[],
    line: CreateInvoiceLineDto,
    supplier?: Supplier | null,
  ): string {
    if (line.categoryCode) {
      return line.categoryCode;
    }
    const best = this.scoreCategories(
      categories,
      normalizeText(`${line.description} ${line.itemCode ?? ''}`),
    );
    if (best && best.score > 0) {
      return best.category.code;
    }
    return supplier?.defaultCategoryCode ?? FALLBACK_CATEGORY_CODE;
  }

  findConsolidationOpportunities(
    invoices: Invoice[],
    categories: SpendCategory[],
  ): ConsolidationOpportunity[] {
    const byCategory = new Map<string, Invoice[]>();
    invoices.forEach((invoice) => {
      byCategory.set(invoice.categoryCode, [...(byCategory.get(invoice.categoryCode) ?? []), invoice]);
    });

    const opportunities: ConsolidationOpportunity[] = [];
    byCategory.forEach((categoryInvoices, code) => {
      const supplierIds = Array.from(new Set(categoryInvoices.map((invoice) => invoice.supplierId)));
      if (supplierIds.length < 2) {
        return;
      }
      const annualSpend = round(
        categoryInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      );
      const category = categories.find((candidate) => candidate.code === code);
      const supplierNames = supplierIds.map(
        (id) => categoryInvoices.find((invoice) => invoice.supplierId === id)?.supplierName ?? id,
      );
      opportunities.push({
        categoryCode: code,
        categoryName: category?.name ?? code,
        supplierIds,
        supplierNames,
        invoiceCount: categoryInvoices.length,
        annualSpend,
        estimatedSavings: round(annualSpend * (0.03 + 0.02 * (supplierIds.length - 1))),
        rationale: `${supplierIds.length} proveedores facturan en la categoria ${
          category?.name ?? code
        }. Unificar volumen permite negociar precio unico y condiciones de pago homogeneas.`,
      });
    });

    return opportunities.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
  }

  private categoryByLineAmount(
    categories: SpendCategory[],
    lines: CreateInvoiceLineDto[],
  ): string | undefined {
    const totals = new Map<string, number>();
    lines.forEach((line) => {
      const best = this.scoreCategories(
        categories,
        normalizeText(`${line.description} ${line.itemCode ?? ''}`),
      );
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

  private scoreCategories(categories: SpendCategory[], text: string): CategoryScore | undefined {
    return categories
      .map((category) => {
        const matchedKeywords = (category.keywords ?? []).filter((keyword) =>
          text.includes(normalizeText(keyword)),
        );
        return { category, score: matchedKeywords.length, matchedKeywords };
      })
      .sort((a, b) => b.score - a.score)[0];
  }
}
