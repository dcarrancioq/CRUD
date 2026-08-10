import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SortDirection } from '../../utils/table-sort';

/** Cabecera de columna ordenable: se usa dentro de un `th` de cualquier listado. */
@Component({
  selector: 'app-sort-header',
  templateUrl: './sort-header.component.html',
  styleUrls: ['./sort-header.component.css']
})
export class SortHeaderComponent {
  @Input() field = '';
  @Input() activeField = '';
  @Input() direction: SortDirection = 'asc';
  @Output() sortChange = new EventEmitter<string>();

  get active(): boolean {
    return this.activeField === this.field;
  }

  get ariaSort(): string {
    if (!this.active) {
      return 'none';
    }
    return this.direction === 'asc' ? 'ascending' : 'descending';
  }

  emit(): void {
    this.sortChange.emit(this.field);
  }
}
