import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-quantity-selector',
  templateUrl: './quantity-selector.component.html',
  styleUrls: ['./quantity-selector.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => QuantitySelectorComponent),
      multi: true
    }
  ]
})
export class QuantitySelectorComponent implements ControlValueAccessor {
  @Input() min: number = 1;
  @Input() max: number = 99;
  @Input() step: number = 1;
  @Input() disabled: boolean = false;
  @Output() quantityChange = new EventEmitter<number>();

  quantity: number = 1;

  private onChange: (value: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: number): void {
    this.quantity = value || this.min;
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  increment(): void {
    if (this.quantity < this.max) {
      this.quantity += this.step;
      this.emitChange();
    }
  }

  decrement(): void {
    if (this.quantity > this.min) {
      this.quantity -= this.step;
      this.emitChange();
    }
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    
    if (isNaN(value)) {
      value = this.min;
    } else if (value < this.min) {
      value = this.min;
    } else if (value > this.max) {
      value = this.max;
    }
    
    this.quantity = value;
    this.emitChange();
  }

  private emitChange(): void {
    this.onChange(this.quantity);
    this.onTouched();
    this.quantityChange.emit(this.quantity);
  }
}
