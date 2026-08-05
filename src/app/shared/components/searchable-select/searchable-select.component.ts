import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  forwardRef
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchableOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * Desplegable con busqueda incremental: el usuario escribe y la lista se reduce.
 * Implementa ControlValueAccessor para poder usarse con `formControlName` y con
 * `[(ngModel)]` igual que un `<select>` nativo.
 */
@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor {
  @Input() options: SearchableOption[] = [];
  @Input() placeholder = 'Selecciona una opcion';
  @Input() searchPlaceholder = 'Escribe para filtrar...';
  @Input() emptyLabel = '';
  @Input() invalid = false;
  @Input() disabled = false;
  @Input() size: 'default' | 'sm' = 'default';

  /** Se emite con el texto escrito, para quien quiera filtrar en servidor. */
  @Output() searchChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<string>();

  open = false;
  search = '';
  value = '';

  private onChangeFn: (value: string) => void = () => undefined;
  private onTouchedFn: () => void = () => undefined;

  constructor(private host: ElementRef<HTMLElement>) {}

  get filteredOptions(): SearchableOption[] {
    const term = this.normalize(this.search);
    if (!term) {
      return this.options;
    }
    return this.options.filter(option =>
      this.normalize(`${option.label} ${option.hint ?? ''}`).includes(term)
    );
  }

  get selectedLabel(): string {
    const selected = this.options.find(option => option.value === this.value);
    if (selected) {
      return selected.label;
    }
    return this.emptyLabel && !this.value ? this.emptyLabel : '';
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }
    this.open = !this.open;
    if (this.open) {
      this.search = '';
    }
  }

  onSearchInput(term: string): void {
    this.search = term;
    this.searchChange.emit(term);
  }

  select(option: SearchableOption): void {
    this.value = option.value;
    this.open = false;
    this.search = '';
    this.onChangeFn(this.value);
    this.onTouchedFn();
    this.selectionChange.emit(this.value);
  }

  clear(event: MouseEvent): void {
    event.stopPropagation();
    this.value = '';
    this.onChangeFn('');
    this.onTouchedFn();
    this.selectionChange.emit('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open && !this.host.nativeElement.contains(event.target as Node)) {
      this.open = false;
      this.onTouchedFn();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }

  private normalize(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
