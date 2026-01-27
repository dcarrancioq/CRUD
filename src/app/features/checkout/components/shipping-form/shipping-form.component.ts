import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { OrderService } from '../../../../core/services/order.service';
import { Address, ShippingMethod } from '../../../../core/models/order.model';

@Component({
  selector: 'app-shipping-form',
  templateUrl: './shipping-form.component.html',
  styleUrls: ['./shipping-form.component.css']
})
export class ShippingFormComponent implements OnInit {
  @Input() initialAddress?: Address;
  @Input() initialMethod?: ShippingMethod;
  @Output() submit = new EventEmitter<{ address: Address; method: ShippingMethod }>();
  @Output() back = new EventEmitter<void>();

  addressForm!: FormGroup;
  shippingMethods: ShippingMethod[] = [];
  selectedMethod?: ShippingMethod;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    this.addressForm = this.fb.group({
      street: [this.initialAddress?.street || '', Validators.required],
      number: [this.initialAddress?.number || '', Validators.required],
      apartment: [this.initialAddress?.apartment || ''],
      city: [this.initialAddress?.city || '', Validators.required],
      state: [this.initialAddress?.state || '', Validators.required],
      postalCode: [this.initialAddress?.postalCode || '', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      country: [this.initialAddress?.country || 'ES', Validators.required]
    });

    this.loadShippingMethods();
  }

  loadShippingMethods(): void {
    this.loading = true;
    this.orderService.getShippingMethods().subscribe({
      next: (methods) => {
        this.shippingMethods = methods;
        this.selectedMethod = this.initialMethod || methods[0];
        this.loading = false;
      },
      error: () => {
        this.shippingMethods = [
          { id: 'standard', name: 'Envio estandar', description: 'Entrega en 3-5 dias laborables', price: 4.99, estimatedDays: { min: 3, max: 5 }, carrier: 'Correos' },
          { id: 'express', name: 'Envio express', description: 'Entrega en 1-2 dias laborables', price: 9.99, estimatedDays: { min: 1, max: 2 }, carrier: 'SEUR' }
        ];
        this.selectedMethod = this.shippingMethods[0];
        this.loading = false;
      }
    });
  }

  selectMethod(method: ShippingMethod): void {
    this.selectedMethod = method;
  }

  onSubmit(): void {
    if (this.addressForm.valid && this.selectedMethod) {
      this.submit.emit({
        address: this.addressForm.value,
        method: this.selectedMethod
      });
    } else {
      this.markFormGroupTouched();
    }
  }

  onBack(): void {
    this.back.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.addressForm.controls).forEach(key => {
      this.addressForm.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.addressForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.addressForm.get(field);
    if (!control) return '';

    if (control.hasError('required')) return 'Este campo es obligatorio';
    if (control.hasError('pattern')) return 'Codigo postal no valido';

    return '';
  }
}
