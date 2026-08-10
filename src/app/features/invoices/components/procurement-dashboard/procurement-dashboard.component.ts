import { Component, OnInit } from '@angular/core';
import { Company, OrgUnit } from '../../../../core/models/invoice.model';
import {
  AnalyticsDimensionRow,
  AnalyticsPeriod,
  AnalyticsPeriodBucket,
  AnalyticsSupplierRow,
  AnalyticsSupplierTrend,
  ProcurementAnalyticsReport
} from '../../../../core/models/procurement-analytics.model';
import { SortValue, TableSortState } from '../../../../shared/utils/table-sort';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';
import { SupplierReportService } from '../../../../core/services/supplier-report.service';

const STATUS_LABELS: Record<string, string> = {
  no_budget: 'Sin presupuesto asignado',
  on_track: 'Ejecucion bajo control',
  warning: 'Ejecucion en zona de aviso',
  exceeded: 'Presupuesto superado'
};

type DimensionView = 'company' | 'orgUnit' | 'category';

type DimensionSortField =
  | 'name'
  | 'assignedAmount'
  | 'consumedAmount'
  | 'committedAmount'
  | 'availableAmount'
  | 'executionPercent'
  | 'deviationAmount'
  | 'yoyVariationPercent'
  | 'invoiceCount'
  | 'supplierCount';

type SupplierSortField =
  | 'legalName'
  | 'awardedAmount'
  | 'consumedAmount'
  | 'orderCount'
  | 'contractCount'
  | 'onTimeDeliveryPercent'
  | 'incidents'
  | 'avgRiskScore'
  | 'yoyVariationPercent'
  | 'sharePercent';

/** Serie de un proveedor lista para pintar como polilinea SVG. */
interface TrendSeries {
  legalName: string;
  points: string;
  color: string;
}

/**
 * Cuadro de mando de compras: presupuesto, consumo, compromisos y desviaciones con
 * filtrado y agrupacion por sociedad, area organizativa, categoria, proveedor y
 * periodo. Todo el calculo llega resuelto del backend sobre la imputacion
 * analitica de cada factura.
 */
@Component({
  selector: 'app-procurement-dashboard',
  templateUrl: './procurement-dashboard.component.html',
  styleUrls: ['./procurement-dashboard.component.css']
})
export class ProcurementDashboardComponent implements OnInit {
  yearOptions: SearchableOption[] = [];
  companyOptions: SearchableOption[] = [];
  categoryOptions: SearchableOption[] = [];
  supplierOptions: SearchableOption[] = [];

  fiscalYear = '';
  period: AnalyticsPeriod = 'month';
  companyId = '';
  orgUnitId = '';
  categoryCode = '';
  supplierId = '';

  report?: ProcurementAnalyticsReport;
  loading = false;
  errorMessage = '';
  dimensionView: DimensionView = 'company';

  readonly periodOptions: SearchableOption[] = [
    { value: 'month', label: 'Mensual' },
    { value: 'quarter', label: 'Trimestral' },
    { value: 'year', label: 'Anual' }
  ];

  readonly dimensionSort = new TableSortState<DimensionSortField>('consumedAmount', 'desc');
  readonly supplierSort = new TableSortState<SupplierSortField>('consumedAmount', 'desc');

  readonly dimensionSortOptions: SearchableOption[] = [
    { value: 'name', label: 'Nombre' },
    { value: 'assignedAmount', label: 'Presupuesto' },
    { value: 'consumedAmount', label: 'Consumo' },
    { value: 'committedAmount', label: 'Compromisos' },
    { value: 'availableAmount', label: 'Disponible' },
    { value: 'executionPercent', label: '% ejecucion' },
    { value: 'deviationAmount', label: 'Desviacion' },
    { value: 'yoyVariationPercent', label: 'Variacion interanual' },
    { value: 'invoiceCount', label: 'Facturas' },
    { value: 'supplierCount', label: 'Proveedores' }
  ];

  supplierSearch = '';

  private companies: Company[] = [];
  private orgUnits: OrgUnit[] = [];
  private readonly trendColors = ['#004666', '#66e4ee', '#7a9bb0', '#c8102e', '#f2a900'];

  constructor(
    private masterData: ProcurementMasterDataService,
    private reports: SupplierReportService
  ) {}

  ngOnInit(): void {
    this.masterData.loadOrganization().subscribe(organization => {
      this.companies = organization.companies;
      this.orgUnits = organization.orgUnits;
      this.companyOptions = organization.companies.map(company => ({
        value: company.id,
        label: company.legalName,
        hint: `${company.code} | ${company.country}`
      }));
    });

    this.masterData.load().subscribe(data => {
      this.categoryOptions = data.categories.map(category => ({
        value: category.code,
        label: category.name,
        hint: category.code
      }));
      this.supplierOptions = data.suppliers.map(supplier => ({
        value: supplier.id,
        label: supplier.legalName,
        hint: `${supplier.taxId} | ${supplier.defaultCategoryCode ?? 'sin categoria'}`
      }));
    });

    this.reports.getAvailableYears().subscribe(years => {
      this.yearOptions = years.map(year => ({ value: String(year), label: String(year) }));
      if (!this.fiscalYear && this.yearOptions.length) {
        this.fiscalYear = this.yearOptions[0].value;
        this.generate();
      }
    });
  }

  /** Las areas dependen de la sociedad: al cambiarla se descarta el area incoherente. */
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
    return Boolean(this.fiscalYear) && !this.loading;
  }

  get statusLabel(): string {
    return this.report ? STATUS_LABELS[this.report.summary.status] ?? '' : '';
  }

  get dimensionRows(): AnalyticsDimensionRow[] {
    if (!this.report) {
      return [];
    }
    const rows =
      this.dimensionView === 'company'
        ? this.report.byCompany
        : this.dimensionView === 'orgUnit'
          ? this.report.byOrgUnit
          : this.report.byCategory;
    return this.dimensionSort.sort(rows, (row, field) => this.dimensionValue(row, field));
  }

  /** Filas de proveedor filtradas por texto y ordenadas por la columna activa. */
  get supplierRows(): AnalyticsSupplierRow[] {
    const term = this.supplierSearch.trim().toLowerCase();
    const rows = (this.report?.suppliers ?? []).filter(
      row =>
        !term ||
        row.legalName.toLowerCase().includes(term) ||
        row.taxId.toLowerCase().includes(term)
    );
    return this.supplierSort.sort(rows, (row, field) => this.supplierValue(row, field));
  }

  sortDimensionBy(field: string): void {
    this.dimensionSort.toggle(field as DimensionSortField);
  }

  /** El desplegable elige columna sin invertir el sentido ya seleccionado. */
  onDimensionSortFieldChange(field: string): void {
    this.dimensionSort.field = field as DimensionSortField;
  }

  toggleDimensionDirection(): void {
    this.dimensionSort.direction = this.dimensionSort.direction === 'asc' ? 'desc' : 'asc';
  }

  sortSuppliersBy(field: string): void {
    this.supplierSort.toggle(field as SupplierSortField);
  }

  private dimensionValue(row: AnalyticsDimensionRow, field: DimensionSortField): SortValue {
    switch (field) {
      case 'name':
        return row.name;
      case 'assignedAmount':
        return row.assignedAmount;
      case 'consumedAmount':
        return row.consumedAmount;
      case 'committedAmount':
        return row.committedAmount;
      case 'availableAmount':
        return row.availableAmount;
      case 'executionPercent':
        return row.executionPercent;
      case 'deviationAmount':
        return row.deviationAmount;
      case 'yoyVariationPercent':
        return row.yoyVariationPercent;
      case 'invoiceCount':
        return row.invoiceCount;
      case 'supplierCount':
        return row.supplierCount;
    }
  }

  private supplierValue(row: AnalyticsSupplierRow, field: SupplierSortField): SortValue {
    switch (field) {
      case 'legalName':
        return row.legalName;
      case 'awardedAmount':
        return row.awardedAmount;
      case 'consumedAmount':
        return row.consumedAmount;
      case 'orderCount':
        return row.orderCount;
      case 'contractCount':
        return row.contractCount;
      case 'onTimeDeliveryPercent':
        return row.onTimeDeliveryPercent;
      case 'incidents':
        return row.incidents;
      case 'avgRiskScore':
        return row.avgRiskScore;
      case 'yoyVariationPercent':
        return row.yoyVariationPercent;
      case 'sharePercent':
        return row.sharePercent;
    }
  }

  get dimensionTitle(): string {
    return this.dimensionView === 'company'
      ? 'Sociedad'
      : this.dimensionView === 'orgUnit'
        ? 'Area / Departamento'
        : 'Categoria de compra';
  }

  /** Escala comun de las barras de ejecucion presupuestaria por dimension. */
  get dimensionScale(): number {
    return Math.max(
      ...this.dimensionRows.map(row => Math.max(row.assignedAmount, row.consumedAmount + row.committedAmount)),
      1
    );
  }

  barWidth(amount: number): number {
    return Math.min(Math.round((amount / this.dimensionScale) * 100), 100);
  }

  executionWidth(percent: number): number {
    return Math.min(Math.max(percent, 0), 100);
  }

  get periodScale(): number {
    if (!this.report) {
      return 1;
    }
    return Math.max(
      ...this.report.periods.map(bucket =>
        Math.max(bucket.consumedAmount, bucket.budgetAmount, bucket.previousYearAmount)
      ),
      1
    );
  }

  periodBarHeight(amount: number): number {
    return Math.round((amount / this.periodScale) * 100);
  }

  /** Series de evolucion de gasto por proveedor (top 5 del ambito filtrado). */
  get trendSeries(): TrendSeries[] {
    const report = this.report;
    if (!report || !report.supplierTrend.length) {
      return [];
    }
    const max = Math.max(...report.supplierTrend.flatMap(trend => trend.amounts), 1);
    const buckets = report.periods.length;
    return report.supplierTrend.map((trend, index) => ({
      legalName: trend.legalName,
      color: this.trendColors[index % this.trendColors.length],
      points: this.toPolyline(trend, max, buckets)
    }));
  }

  get periodLabels(): string[] {
    return (this.report?.periods ?? []).map(bucket => bucket.label);
  }

  deviationClass(value: number): string {
    return value > 0 ? 'negative' : 'positive';
  }

  yoyLabel(bucket: AnalyticsPeriodBucket | AnalyticsDimensionRow): string {
    return bucket.yoyVariationPercent === undefined
      ? 'sin base'
      : `${bucket.yoyVariationPercent > 0 ? '+' : ''}${bucket.yoyVariationPercent.toFixed(1)}%`;
  }

  generate(): void {
    if (!this.canGenerate) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.reports
      .getAnalytics({
        fiscalYear: Number(this.fiscalYear),
        period: this.period,
        companyId: this.companyId || undefined,
        orgUnitId: this.orgUnitId || undefined,
        categoryCode: this.categoryCode || undefined,
        supplierId: this.supplierId || undefined
      })
      .subscribe({
        next: report => {
          this.report = report;
          this.loading = false;
        },
        error: () => {
          this.report = undefined;
          this.loading = false;
          this.errorMessage = 'No se ha podido generar el cuadro de mando con los filtros seleccionados.';
        }
      });
  }

  resetFilters(): void {
    this.companyId = '';
    this.orgUnitId = '';
    this.categoryCode = '';
    this.supplierId = '';
    this.period = 'month';
    this.generate();
  }

  private toPolyline(trend: AnalyticsSupplierTrend, max: number, buckets: number): string {
    const step = buckets > 1 ? 100 / (buckets - 1) : 0;
    return trend.amounts
      .slice(0, buckets)
      .map((amount, index) => `${(index * step).toFixed(2)},${(100 - (amount / max) * 100).toFixed(2)}`)
      .join(' ');
  }
}
