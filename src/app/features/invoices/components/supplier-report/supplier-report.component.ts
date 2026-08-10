import { Component, OnInit } from '@angular/core';
import { Company, OrgUnit, Supplier } from '../../../../core/models/invoice.model';
import {
  SupplierReport,
  SupplierReportCategory,
  SupplierReportDeviation,
  SupplierReportInvoice,
  SupplierReportMonth
} from '../../../../core/models/supplier-report.model';
import { SortValue, TableSortState } from '../../../../shared/utils/table-sort';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';
import { SupplierReportService } from '../../../../core/services/supplier-report.service';

type MonthSortField =
  | 'month'
  | 'invoiceCount'
  | 'amount'
  | 'cumulativeAmount'
  | 'budgetCumulativeAmount'
  | 'deviationPercent';

type DeviationSortField = 'label' | 'value' | 'reference' | 'deviationPercent';

type CategorySortField = 'categoryName' | 'invoiceCount' | 'amount' | 'sharePercent';

type ReportInvoiceSortField =
  | 'invoiceNumber'
  | 'issueDate'
  | 'categoryName'
  | 'totalAmount'
  | 'status'
  | 'riskScore'
  | 'openExceptions';

const STATUS_LABELS: Record<string, string> = {
  no_budget: 'Sin presupuesto asignado',
  on_track: 'Consumo bajo control',
  warning: 'Consumo en zona de aviso',
  exceeded: 'Presupuesto superado'
};

@Component({
  selector: 'app-supplier-report',
  templateUrl: './supplier-report.component.html',
  styleUrls: ['./supplier-report.component.css']
})
export class SupplierReportComponent implements OnInit {
  supplierOptions: SearchableOption[] = [];
  yearOptions: SearchableOption[] = [];
  companyOptions: SearchableOption[] = [];
  categoryOptions: SearchableOption[] = [];
  supplierId = '';
  fiscalYear = '';
  companyId = '';
  orgUnitId = '';
  categoryCode = '';

  private companies: Company[] = [];
  private orgUnits: OrgUnit[] = [];
  report?: SupplierReport;
  loading = false;
  errorMessage = '';

  readonly monthSort = new TableSortState<MonthSortField>('month', 'asc');
  readonly deviationSort = new TableSortState<DeviationSortField>('deviationPercent', 'desc');
  readonly categorySort = new TableSortState<CategorySortField>('amount', 'desc');
  readonly invoiceSort = new TableSortState<ReportInvoiceSortField>('issueDate', 'desc');
  invoiceSearch = '';

  constructor(
    private masterData: ProcurementMasterDataService,
    private reports: SupplierReportService
  ) {}

  ngOnInit(): void {
    this.masterData.getSuppliers().subscribe(suppliers => {
      this.supplierOptions = suppliers.map(supplier => this.toSupplierOption(supplier));
    });

    this.masterData.loadOrganization().subscribe(organization => {
      this.companies = organization.companies;
      this.orgUnits = organization.orgUnits;
      this.companyOptions = organization.companies.map(company => ({
        value: company.id,
        label: company.legalName,
        hint: `${company.code} | ${company.country}`
      }));
    });

    this.masterData.getCategories().subscribe(categories => {
      this.categoryOptions = categories.map(category => ({
        value: category.code,
        label: category.name,
        hint: category.code
      }));
    });

    this.reports.getAvailableYears().subscribe(years => {
      this.yearOptions = years.map(year => ({ value: String(year), label: String(year) }));
      if (!this.fiscalYear && this.yearOptions.length) {
        this.fiscalYear = this.yearOptions[0].value;
      }
    });
  }

  /** Las areas se limitan a la sociedad elegida: no existen areas transversales. */
  get orgUnitOptions(): SearchableOption[] {
    return this.orgUnits
      .filter(unit => !this.companyId || unit.companyId === this.companyId)
      .map(unit => ({
        value: unit.id,
        label: unit.name,
        hint: this.companies.find(company => company.id === unit.companyId)?.legalName ?? unit.companyId
      }));
  }

  onCompanyChange(): void {
    const unit = this.orgUnits.find(item => item.id === this.orgUnitId);
    if (unit && this.companyId && unit.companyId !== this.companyId) {
      this.orgUnitId = '';
    }
  }

  get canGenerate(): boolean {
    return Boolean(this.supplierId && this.fiscalYear) && !this.loading;
  }

  get statusLabel(): string {
    return this.report ? STATUS_LABELS[this.report.consumption.status] ?? '' : '';
  }

  /** Ancho de la barra de consumo, acotado para que no desborde cuando se pasa del 100%. */
  get consumedBarWidth(): number {
    return this.report ? Math.min(this.report.consumption.consumedPercent, 100) : 0;
  }

  get maxMonthlyAmount(): number {
    if (!this.report) {
      return 0;
    }
    return Math.max(...this.report.monthly.map(month => month.amount), 1);
  }

  monthBarHeight(month: SupplierReportMonth): number {
    return Math.round((month.amount / this.maxMonthlyAmount) * 100);
  }

  get monthlyRows(): SupplierReportMonth[] {
    return this.monthSort.sort(this.report?.monthly ?? [], (row, field) => this.monthValue(row, field));
  }

  get deviationRows(): SupplierReportDeviation[] {
    return this.deviationSort.sort(this.report?.deviations ?? [], (row, field) =>
      this.deviationValue(row, field)
    );
  }

  get categoryRows(): SupplierReportCategory[] {
    return this.categorySort.sort(this.report?.categories ?? [], (row, field) =>
      this.categoryValue(row, field)
    );
  }

  get invoiceRows(): SupplierReportInvoice[] {
    const term = this.invoiceSearch.trim().toLowerCase();
    const rows = (this.report?.invoices ?? []).filter(
      row =>
        !term ||
        row.invoiceNumber.toLowerCase().includes(term) ||
        row.categoryName.toLowerCase().includes(term) ||
        row.status.toLowerCase().includes(term)
    );
    return this.invoiceSort.sort(rows, (row, field) => this.invoiceValue(row, field));
  }

  sortMonthsBy(field: string): void {
    this.monthSort.toggle(field as MonthSortField);
  }

  sortDeviationsBy(field: string): void {
    this.deviationSort.toggle(field as DeviationSortField);
  }

  sortCategoriesBy(field: string): void {
    this.categorySort.toggle(field as CategorySortField);
  }

  sortInvoicesBy(field: string): void {
    this.invoiceSort.toggle(field as ReportInvoiceSortField);
  }

  generate(): void {
    if (!this.canGenerate) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.reports
      .getSupplierReport(this.supplierId, Number(this.fiscalYear), {
        companyId: this.companyId || undefined,
        orgUnitId: this.orgUnitId || undefined,
        categoryCode: this.categoryCode || undefined
      })
      .subscribe({
        next: report => {
          this.report = report;
          this.loading = false;
        },
        error: () => {
          this.report = undefined;
          this.loading = false;
          this.errorMessage =
            'No se ha podido generar el informe. Revisa el proveedor y el ejercicio seleccionados.';
        }
      });
  }

  private monthValue(row: SupplierReportMonth, field: MonthSortField): SortValue {
    switch (field) {
      case 'month':
        return row.month;
      case 'invoiceCount':
        return row.invoiceCount;
      case 'amount':
        return row.amount;
      case 'cumulativeAmount':
        return row.cumulativeAmount;
      case 'budgetCumulativeAmount':
        return row.budgetCumulativeAmount;
      case 'deviationPercent':
        return row.deviationPercent;
    }
  }

  private deviationValue(row: SupplierReportDeviation, field: DeviationSortField): SortValue {
    switch (field) {
      case 'label':
        return row.label;
      case 'value':
        return row.value;
      case 'reference':
        return row.reference;
      case 'deviationPercent':
        return row.deviationPercent;
    }
  }

  private categoryValue(row: SupplierReportCategory, field: CategorySortField): SortValue {
    switch (field) {
      case 'categoryName':
        return row.categoryName;
      case 'invoiceCount':
        return row.invoiceCount;
      case 'amount':
        return row.amount;
      case 'sharePercent':
        return row.sharePercent;
    }
  }

  private invoiceValue(row: SupplierReportInvoice, field: ReportInvoiceSortField): SortValue {
    switch (field) {
      case 'invoiceNumber':
        return row.invoiceNumber;
      case 'issueDate':
        return row.issueDate;
      case 'categoryName':
        return row.categoryName;
      case 'totalAmount':
        return row.totalAmount;
      case 'status':
        return row.status;
      case 'riskScore':
        return row.riskScore;
      case 'openExceptions':
        return row.openExceptions;
    }
  }

  private toSupplierOption(supplier: Supplier): SearchableOption {
    return {
      value: supplier.id,
      label: supplier.legalName,
      hint: `${supplier.taxId} | ${supplier.defaultCategoryCode ?? 'sin categoria'}`
    };
  }
}
