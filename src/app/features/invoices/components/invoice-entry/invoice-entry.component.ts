import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap, takeUntil } from 'rxjs';
import {
  CreateInvoiceRequest,
  Invoice,
  InvoiceException,
  SpendCategory,
  Supplier,
  SupplierBankAccount,
  ToleranceProfile
} from '../../../../core/models/invoice.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';

@Component({
  selector: 'app-invoice-entry',
  templateUrl: './invoice-entry.component.html',
  styleUrls: ['./invoice-entry.component.css']
})
export class InvoiceEntryComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  suppliers: Supplier[] = [];
  categories: SpendCategory[] = [];
  toleranceProfile?: ToleranceProfile;
  preview?: Invoice;
  saving = false;
  devinRequestPreview?: DevinSessionRequest;

  private readonly evaluateTrigger = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private masterData: ProcurementMasterDataService,
    private invoiceService: InvoiceService,
    private devinApi: DevinApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.addLine();

    this.masterData.load()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.suppliers = data.suppliers;
        this.categories = data.categories;
        this.toleranceProfile = data.toleranceProfile;
      });

    // La evaluacion de tolerancias la hace el backend: se agrupan los cambios del
    // formulario para no lanzar una peticion por tecla.
    this.evaluateTrigger
      .pipe(
        debounceTime(400),
        switchMap(() =>
          this.invoiceService.previewInvoice(this.buildRequest()).pipe(catchError(() => of(undefined)))
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(preview => (this.preview = preview));

    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.evaluate());
    this.evaluate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  get lineGroups(): FormGroup[] {
    return this.lines.controls as FormGroup[];
  }

  get selectedSupplier(): Supplier | undefined {
    const supplierId = this.form.get('supplierId')?.value;
    return this.suppliers.find(supplier => supplier.id === supplierId);
  }

  get supplierAccounts(): SupplierBankAccount[] {
    return this.selectedSupplier?.bankAccounts ?? [];
  }

  get supplierOptions(): SearchableOption[] {
    return this.suppliers.map(supplier => ({
      value: supplier.id,
      label: supplier.legalName,
      hint: `${supplier.taxId} | ${supplier.defaultCategoryCode ?? 'sin categoria'}`
    }));
  }

  get categoryOptions(): SearchableOption[] {
    return this.categories.map(category => ({
      value: category.code,
      label: category.name,
      hint: category.code
    }));
  }

  readonly currencyOptions: SearchableOption[] = [
    { value: 'EUR', label: 'EUR' },
    { value: 'USD', label: 'USD' },
    { value: 'GBP', label: 'GBP' }
  ];

  readonly paymentMethodOptions: SearchableOption[] = [
    { value: 'transfer', label: 'Transferencia' },
    { value: 'direct_debit', label: 'Domiciliacion' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'check', label: 'Cheque' }
  ];

  readonly sourceOptions: SearchableOption[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'ocr', label: 'OCR' },
    { value: 'edi', label: 'EDI' },
    { value: 'email', label: 'Correo' },
    { value: 'supplier_portal', label: 'Portal proveedor' }
  ];

  get computedSubtotal(): number {
    return this.round(
      this.lines.controls.reduce((sum, control) => {
        const quantity = Number(control.get('quantity')?.value) || 0;
        const unitPrice = Number(control.get('unitPrice')?.value) || 0;
        return sum + quantity * unitPrice;
      }, 0)
    );
  }

  get computedTax(): number {
    const declaredSubtotal = Number(this.form.get('declaredSubtotal')?.value);
    const base = declaredSubtotal > 0 ? declaredSubtotal : this.computedSubtotal;
    return this.round((base * (Number(this.form.get('taxRate')?.value) || 0)) / 100);
  }

  get computedTotal(): number {
    const declaredSubtotal = Number(this.form.get('declaredSubtotal')?.value);
    const base = declaredSubtotal > 0 ? declaredSubtotal : this.computedSubtotal;
    const declaredTax = Number(this.form.get('declaredTaxAmount')?.value);
    const tax = declaredTax > 0 ? declaredTax : this.computedTax;
    return this.round(base + tax);
  }

  get blockingExceptions(): InvoiceException[] {
    return (this.preview?.exceptions ?? []).filter(exception => exception.blocksPayment);
  }

  get toleratedExceptions(): InvoiceException[] {
    return (this.preview?.exceptions ?? []).filter(exception => !exception.blocksPayment);
  }

  addLine(): void {
    this.lines.push(
      this.fb.group({
        itemCode: [''],
        description: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        uom: ['unidad', Validators.required],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        taxRate: [21, [Validators.required, Validators.min(0)]],
        categoryCode: [''],
        costCenter: ['']
      })
    );
  }

  removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  onSupplierChange(): void {
    const supplier = this.selectedSupplier;
    if (!supplier) {
      return;
    }
    const primary = supplier.bankAccounts.find(account => account.isPrimary) ?? supplier.bankAccounts[0];
    this.form.patchValue(
      {
        paymentTermsDays: supplier.paymentTermsDays,
        bankAccountIban: primary?.iban ?? '',
        bankAccountHolder: primary?.holderName ?? ''
      },
      { emitEvent: true }
    );
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  lineTotal(index: number): number {
    const control = this.lines.at(index);
    return this.round((Number(control.get('quantity')?.value) || 0) * (Number(control.get('unitPrice')?.value) || 0));
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notificationService.error('Revisa los campos obligatorios de la factura.');
      return;
    }
    this.saving = true;
    this.invoiceService.createInvoice(this.buildRequest()).subscribe({
      next: invoice => {
      this.saving = false;
      if (invoice.status === 'blocked') {
        this.notificationService.warning(
          `Factura ${invoice.invoiceNumber} registrada y BLOQUEADA para pago: ${invoice.exceptions.length} excepciones sobre tolerancia.`
        );
      } else if (invoice.exceptions.length) {
        this.notificationService.info(
          `Factura ${invoice.invoiceNumber} registrada con ${invoice.exceptions.length} excepciones en revision.`
        );
      } else {
        this.notificationService.success(`Factura ${invoice.invoiceNumber} registrada y aprobada automaticamente.`);
      }
      this.router.navigate(['/invoices']);
      },
      error: () => {
        this.saving = false;
        this.notificationService.error('No se pudo registrar la factura en el backend.');
      }
    });
  }

  requestDevinInvestigation(exception: InvoiceException): void {
    if (!this.preview) {
      return;
    }
    // En el alta la factura aun no existe en BBDD: se muestra la llamada que el
    // backend enviara a Devin al resolver la excepcion desde el listado.

    if (exception.ruleCode === 'BANK_ACCOUNT_UNKNOWN' || exception.ruleCode === 'BANK_ACCOUNT_RECENT_CHANGE') {
      this.devinRequestPreview = this.devinApi.buildBankAccountVerificationRequest(this.preview, exception);
      return;
    }
    const candidate = this.preview.duplicateCandidates[0];
    if (candidate) {
      this.devinRequestPreview = this.devinApi.buildDuplicateInvestigationRequest(this.preview, candidate, exception);
    }
  }

  get devinRequestPreviewJson(): string {
    return this.devinRequestPreview ? JSON.stringify(this.devinRequestPreview, null, 2) : '';
  }

  private buildRequest(): CreateInvoiceRequest {
    const value = this.form.value;
    return {
      invoiceNumber: value.invoiceNumber,
      supplierId: value.supplierId,
      purchaseOrderNumber: this.optional(value.purchaseOrderNumber),
      contractReference: this.optional(value.contractReference),
      issueDate: value.issueDate,
      receivedDate: value.receivedDate,
      dueDate: value.dueDate,
      currency: value.currency,
      exchangeRate: Number(value.exchangeRate) || 1,
      taxRate: Number(value.taxRate) || 0,
      paymentTermsDays: Number(value.paymentTermsDays) || 0,
      paymentMethod: value.paymentMethod,
      bankAccountIban: value.bankAccountIban,
      bankAccountHolder: this.optional(value.bankAccountHolder),
      costCenter: value.costCenter,
      requesterEmail: this.optional(value.requesterEmail),
      description: this.optional(value.description),
      source: value.source,
      manualCategoryCode: value.manualCategoryCode || undefined,
      declaredSubtotal: Number(value.declaredSubtotal) > 0 ? Number(value.declaredSubtotal) : undefined,
      declaredTaxAmount: Number(value.declaredTaxAmount) > 0 ? Number(value.declaredTaxAmount) : undefined,
      declaredTotalAmount: Number(value.declaredTotalAmount) > 0 ? Number(value.declaredTotalAmount) : undefined,
      lines: (value.lines ?? []).map((line: Record<string, string | number>) => ({
        itemCode: this.optional(line['itemCode'] as string),
        description: line['description'] as string,
        quantity: Number(line['quantity']) || 0,
        uom: line['uom'] as string,
        unitPrice: Number(line['unitPrice']) || 0,
        taxRate: Number(line['taxRate']) || 0,
        categoryCode: this.optional(line['categoryCode'] as string),
        costCenter: this.optional(line['costCenter'] as string)
      }))
    };
  }

  /** El backend valida los opcionales: una cadena vacia no es un email ni un PO valido. */
  private optional(value: string | null | undefined): string | undefined {
    const trimmed = (value ?? '').trim();
    return trimmed.length ? trimmed : undefined;
  }

  private evaluate(): void {
    const supplierId = this.form.get('supplierId')?.value;
    const hasLines = this.lines.controls.some(control => !!control.get('description')?.value);
    if (!supplierId || !hasLines || this.form.get('invoiceNumber')?.invalid) {
      this.preview = undefined;
      return;
    }
    this.evaluateTrigger.next();
  }

  private initForm(): void {
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    this.form = this.fb.group({
      invoiceNumber: ['', Validators.required],
      supplierId: ['', Validators.required],
      purchaseOrderNumber: [''],
      contractReference: [''],
      issueDate: [today, Validators.required],
      receivedDate: [today, Validators.required],
      dueDate: [due, Validators.required],
      currency: ['EUR', Validators.required],
      exchangeRate: [1, [Validators.required, Validators.min(0.0001)]],
      taxRate: [21, [Validators.required, Validators.min(0)]],
      paymentTermsDays: [30, [Validators.required, Validators.min(0)]],
      paymentMethod: ['transfer', Validators.required],
      bankAccountIban: ['', [Validators.required, Validators.minLength(15)]],
      bankAccountHolder: [''],
      costCenter: ['CC-IT-INFRA', Validators.required],
      requesterEmail: [''],
      description: [''],
      source: ['manual', Validators.required],
      manualCategoryCode: [''],
      declaredSubtotal: [null],
      declaredTaxAmount: [null],
      declaredTotalAmount: [null],
      lines: this.fb.array([])
    });
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
