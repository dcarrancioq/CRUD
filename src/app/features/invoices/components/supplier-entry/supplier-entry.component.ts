import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SpendCategory, Supplier } from '../../../../core/models/invoice.model';
import { ImportedSupplierCandidate } from '../../../../core/models/invoice-import.model';
import { CreateSupplierRequest } from '../../../../core/models/supplier-registration.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';

/**
 * Alta de proveedor en el maestro. Se abre desde la importacion de una factura
 * cuando el emisor no esta dado de alta, prerrellenada con lo leido del fichero,
 * y tambien es accesible como pantalla propia.
 */
@Component({
  selector: 'app-supplier-entry',
  templateUrl: './supplier-entry.component.html',
  styleUrls: ['./supplier-entry.component.css']
})
export class SupplierEntryComponent implements OnInit {
  /** Datos del emisor leidos del documento importado, si los hay. */
  @Input() candidate?: ImportedSupplierCandidate;
  /** True cuando se muestra dentro del alta de factura en lugar de como pantalla. */
  @Input() embedded = false;
  @Output() saved = new EventEmitter<Supplier>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  categories: SpendCategory[] = [];
  saving = false;
  errorMessage = '';

  readonly statusOptions: SearchableOption[] = [
    { value: 'pending_validation', label: 'Pendiente de validacion', hint: 'Alta provisional hasta verificar datos' },
    { value: 'active', label: 'Activo', hint: 'Puede facturar y cobrar' },
    { value: 'blocked', label: 'Bloqueado', hint: 'No se liberan pagos' },
    { value: 'inactive', label: 'Inactivo', hint: 'Sin actividad' }
  ];

  readonly verificationOptions: SearchableOption[] = [
    { value: 'none', label: 'Sin verificar', hint: 'La cuenta queda pendiente de verificacion' },
    { value: 'callback', label: 'Llamada al proveedor', hint: 'Verificacion telefonica con contacto conocido' },
    { value: 'portal', label: 'Portal de proveedores', hint: 'Alta realizada por el propio proveedor' },
    { value: 'certificate', label: 'Certificado bancario', hint: 'Documento de titularidad aportado' }
  ];

  readonly countryOptions: SearchableOption[] = [
    { value: 'ES', label: 'España (ES)' },
    { value: 'PT', label: 'Portugal (PT)' },
    { value: 'FR', label: 'Francia (FR)' },
    { value: 'DE', label: 'Alemania (DE)' },
    { value: 'IT', label: 'Italia (IT)' },
    { value: 'NL', label: 'Paises Bajos (NL)' },
    { value: 'IE', label: 'Irlanda (IE)' },
    { value: 'GB', label: 'Reino Unido (GB)' },
    { value: 'US', label: 'Estados Unidos (US)' }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private masterData: ProcurementMasterDataService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const currentYear = new Date().getFullYear();
    this.form = this.fb.group({
      taxId: [this.candidate?.taxId ?? '', [Validators.required, Validators.minLength(6)]],
      legalName: [this.candidate?.legalName ?? '', [Validators.required, Validators.minLength(2)]],
      tradeName: [''],
      country: [this.candidate?.country ?? 'ES', Validators.required],
      status: ['pending_validation', Validators.required],
      defaultCategoryCode: [''],
      paymentTermsDays: [this.candidate?.paymentTermsDays ?? 30, [Validators.required, Validators.min(0), Validators.max(365)]],
      contactEmail: [this.candidate?.contactEmail ?? '', Validators.email],
      riskScore: [0, [Validators.min(0), Validators.max(100)]],
      iban: [this.candidate?.iban ?? ''],
      bic: [''],
      holderName: [this.candidate?.holderName ?? this.candidate?.legalName ?? ''],
      verificationChannel: ['none'],
      fiscalYear: [currentYear, [Validators.min(2000), Validators.max(2100)]],
      budgetAmount: [null as number | null, Validators.min(0)],
      budgetCurrency: ['EUR'],
      alertThresholdPercent: [85, [Validators.min(1), Validators.max(100)]],
      ownerEmail: ['', Validators.email]
    });

    this.masterData.getCategories().subscribe(categories => (this.categories = categories));
  }

  get categoryOptions(): SearchableOption[] {
    return this.categories.map(category => ({
      value: category.code,
      label: `${category.code} - ${category.name}`
    }));
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.masterData.createSupplier(this.buildPayload()).subscribe({
      next: supplier => {
        this.saving = false;
        this.notificationService.success(`Proveedor ${supplier.legalName} dado de alta en el maestro.`);
        this.saved.emit(supplier);
        if (!this.embedded) {
          this.router.navigate(['/invoices/new']);
        }
      },
      error: error => {
        this.saving = false;
        this.errorMessage = error?.error?.message ?? 'No se ha podido dar de alta el proveedor.';
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
    if (!this.embedded) {
      this.router.navigate(['/invoices/new']);
    }
  }

  private buildPayload(): CreateSupplierRequest {
    const value = this.form.value;
    const payload: CreateSupplierRequest = {
      taxId: String(value.taxId).trim(),
      legalName: String(value.legalName).trim(),
      tradeName: this.optional(value.tradeName),
      country: value.country,
      status: value.status,
      defaultCategoryCode: this.optional(value.defaultCategoryCode),
      paymentTermsDays: Number(value.paymentTermsDays),
      contactEmail: this.optional(value.contactEmail),
      riskScore: Number(value.riskScore ?? 0)
    };

    const iban = this.optional(value.iban);
    if (iban) {
      payload.bankAccount = {
        iban,
        bic: this.optional(value.bic),
        holderName: this.optional(value.holderName) ?? payload.legalName,
        verificationChannel: value.verificationChannel
      };
    }

    const budgetAmount = value.budgetAmount === null || value.budgetAmount === '' ? undefined : Number(value.budgetAmount);
    if (budgetAmount !== undefined && budgetAmount > 0) {
      payload.budget = {
        fiscalYear: Number(value.fiscalYear),
        budgetAmount,
        currency: value.budgetCurrency,
        alertThresholdPercent: Number(value.alertThresholdPercent),
        ownerEmail: this.optional(value.ownerEmail)
      };
    }

    return payload;
  }

  private optional(value: string | null | undefined): string | undefined {
    const trimmed = (value ?? '').trim();
    return trimmed.length ? trimmed : undefined;
  }
}
