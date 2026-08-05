import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  CreateInvoiceRequest,
  Invoice,
  InvoiceException,
  SpendCategory,
  Supplier,
  SupplierBankAccount,
  ToleranceProfile
} from '../../../../core/models/invoice.model';
import { DevinApiService, DevinSessionRequest } from '../../../../core/services/devin-api.service';
import { InvoiceService } from '../../../../core/services/invoice.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProcurementMasterDataService } from '../../../../core/services/procurement-master-data.service';

@Component({
  selector: 'app-invoice-entry',
  templateUrl: './invoice-entry.component.html',
  styleUrls: ['./invoice-entry.component.css']
})
export class InvoiceEntryComponent implements OnInit {
  form!: FormGroup;
  suppliers: Supplier[] = [];
  categories: SpendCategory[] = [];
  toleranceProfile!: ToleranceProfile;
  preview?: Invoice;
  saving = false;
  devinRequestPreview?: DevinSessionRequest;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private masterData: ProcurementMasterDataService,
    private invoiceService: InvoiceService,
    private devinApi: DevinApiService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.suppliers = this.masterData.getSuppliers();
    this.categories = this.masterData.getCategories();
    this.toleranceProfile = this.masterData.getToleranceProfile();
    this.initForm();
    this.addLine();
    this.form.valueChanges.subscribe(() => this.evaluate());
    this.evaluate();
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  get lineGroups(): FormGroup[] {
    return this.lines.controls as FormGroup[];
  }

  get selectedSupplier(): Supplier | undefined {
    return this.masterData.getSupplier(this.form.get('supplierId')?.value);
  }

  get supplierAccounts(): SupplierBankAccount[] {
    return this.selectedSupplier?.bankAccounts ?? [];
  }

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
    this.invoiceService.createInvoice(this.buildRequest()).subscribe(invoice => {
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
    });
  }

  requestDevinInvestigation(exception: InvoiceException): void {
    if (!this.preview) {
      return;
    }
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
      purchaseOrderNumber: value.purchaseOrderNumber,
      contractReference: value.contractReference,
      issueDate: value.issueDate,
      receivedDate: value.receivedDate,
      dueDate: value.dueDate,
      currency: value.currency,
      exchangeRate: Number(value.exchangeRate) || 1,
      taxRate: Number(value.taxRate) || 0,
      paymentTermsDays: Number(value.paymentTermsDays) || 0,
      paymentMethod: value.paymentMethod,
      bankAccountIban: value.bankAccountIban,
      bankAccountHolder: value.bankAccountHolder,
      costCenter: value.costCenter,
      requesterEmail: value.requesterEmail,
      description: value.description,
      source: value.source,
      manualCategoryCode: value.manualCategoryCode || undefined,
      declaredSubtotal: Number(value.declaredSubtotal) > 0 ? Number(value.declaredSubtotal) : undefined,
      declaredTaxAmount: Number(value.declaredTaxAmount) > 0 ? Number(value.declaredTaxAmount) : undefined,
      declaredTotalAmount: Number(value.declaredTotalAmount) > 0 ? Number(value.declaredTotalAmount) : undefined,
      lines: (value.lines ?? []).map((line: Record<string, string | number>) => ({
        itemCode: (line['itemCode'] as string) || undefined,
        description: line['description'] as string,
        quantity: Number(line['quantity']) || 0,
        uom: line['uom'] as string,
        unitPrice: Number(line['unitPrice']) || 0,
        taxRate: Number(line['taxRate']) || 0,
        categoryCode: (line['categoryCode'] as string) || undefined,
        costCenter: (line['costCenter'] as string) || undefined
      }))
    };
  }

  private evaluate(): void {
    const supplierId = this.form.get('supplierId')?.value;
    const hasLines = this.lines.controls.some(control => !!control.get('description')?.value);
    if (!supplierId || !hasLines) {
      this.preview = undefined;
      return;
    }
    this.preview = this.invoiceService.previewInvoice(this.buildRequest());
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
