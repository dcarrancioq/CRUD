import { Component, OnInit } from '@angular/core';
import { Supplier } from '../../../../core/models/invoice.model';
import { SupplierReport, SupplierReportMonth } from '../../../../core/models/supplier-report.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';
import { SupplierReportService } from '../../../../core/services/supplier-report.service';

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
  supplierId = '';
  fiscalYear = '';
  report?: SupplierReport;
  loading = false;
  errorMessage = '';

  constructor(
    private masterData: ProcurementMasterDataService,
    private reports: SupplierReportService
  ) {}

  ngOnInit(): void {
    this.masterData.getSuppliers().subscribe(suppliers => {
      this.supplierOptions = suppliers.map(supplier => this.toSupplierOption(supplier));
    });

    this.reports.getAvailableYears().subscribe(years => {
      this.yearOptions = years.map(year => ({ value: String(year), label: String(year) }));
      if (!this.fiscalYear && this.yearOptions.length) {
        this.fiscalYear = this.yearOptions[0].value;
      }
    });
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

  generate(): void {
    if (!this.canGenerate) {
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.reports.getSupplierReport(this.supplierId, Number(this.fiscalYear)).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
      },
      error: () => {
        this.report = undefined;
        this.loading = false;
        this.errorMessage = 'No se ha podido generar el informe. Revisa el proveedor y el ejercicio seleccionados.';
      }
    });
  }

  private toSupplierOption(supplier: Supplier): SearchableOption {
    return {
      value: supplier.id,
      label: supplier.legalName,
      hint: `${supplier.taxId} | ${supplier.defaultCategoryCode ?? 'sin categoria'}`
    };
  }
}
