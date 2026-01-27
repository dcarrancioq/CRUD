import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-payment-form',
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.css']
})
export class PaymentFormComponent implements OnInit {
  @Input() initialMethod?: string;
  @Output() submit = new EventEmitter<{ method: string; details: any }>();
  @Output() back = new EventEmitter<void>();

  selectedMethod: string = 'card';
  cardForm!: FormGroup;

  paymentMethods = [
    { id: 'card', name: 'Tarjeta de credito/debito', icon: 'credit-card' },
    { id: 'paypal', name: 'PayPal', icon: 'paypal' },
    { id: 'transfer', name: 'Transferencia bancaria', icon: 'bank' }
  ];

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.selectedMethod = this.initialMethod || 'card';
    
    this.cardForm = this.fb.group({
      cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{16}$/)]],
      cardHolder: ['', Validators.required],
      expiryDate: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/([0-9]{2})$/)]],
      cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]]
    });
  }

  selectMethod(methodId: string): void {
    this.selectedMethod = methodId;
  }

  onSubmit(): void {
    if (this.selectedMethod === 'card') {
      if (this.cardForm.valid) {
        this.submit.emit({
          method: this.selectedMethod,
          details: this.cardForm.value
        });
      } else {
        this.markFormGroupTouched();
      }
    } else {
      this.submit.emit({
        method: this.selectedMethod,
        details: {}
      });
    }
  }

  onBack(): void {
    this.back.emit();
  }

  private markFormGroupTouched(): void {
    Object.keys(this.cardForm.controls).forEach(key => {
      this.cardForm.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.cardForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.cardForm.get(field);
    if (!control) return '';

    if (control.hasError('required')) return 'Este campo es obligatorio';
    if (control.hasError('pattern')) {
      switch (field) {
        case 'cardNumber': return 'Numero de tarjeta no valido (16 digitos)';
        case 'expiryDate': return 'Formato: MM/YY';
        case 'cvv': return 'CVV no valido (3-4 digitos)';
        default: return 'Formato no valido';
      }
    }

    return '';
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.slice(0, 16);
    this.cardForm.get('cardNumber')?.setValue(value);
  }

  formatExpiryDate(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.slice(0, 4);
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
    this.cardForm.get('expiryDate')?.setValue(value);
  }
}
