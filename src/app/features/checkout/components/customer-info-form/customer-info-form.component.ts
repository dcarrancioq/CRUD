import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-customer-info-form',
  templateUrl: './customer-info-form.component.html',
  styleUrls: ['./customer-info-form.component.css']
})
export class CustomerInfoFormComponent implements OnInit {
  @Input() initialData?: { firstName: string; lastName: string; email: string; phone: string };
  @Output() submit = new EventEmitter<{ firstName: string; lastName: string; email: string; phone: string }>();

  form!: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: [this.initialData?.firstName || '', [Validators.required, Validators.minLength(2)]],
      lastName: [this.initialData?.lastName || '', [Validators.required, Validators.minLength(2)]],
      email: [this.initialData?.email || '', [Validators.required, Validators.email]],
      phone: [this.initialData?.phone || '', [Validators.required, Validators.pattern(/^[0-9]{9,15}$/)]]
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.submit.emit(this.form.value);
    } else {
      this.markFormGroupTouched();
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control) return '';

    if (control.hasError('required')) return 'Este campo es obligatorio';
    if (control.hasError('minlength')) return 'Minimo 2 caracteres';
    if (control.hasError('email')) return 'Email no valido';
    if (control.hasError('pattern')) return 'Telefono no valido';

    return '';
  }
}
