export type SortDirection = 'asc' | 'desc';

/** Valor comparable de una celda; `undefined` y `null` se ordenan siempre al final. */
export type SortValue = string | number | Date | undefined | null;

/**
 * Estado de ordenacion de una tabla. Se comparte entre listados para que todos
 * respondan igual: primer clic ordena, segundo invierte, y los vacios quedan al final.
 */
export class TableSortState<F extends string> {
  constructor(
    public field: F,
    public direction: SortDirection = 'asc'
  ) {}

  toggle(field: F): void {
    if (this.field === field) {
      this.direction = this.direction === 'asc' ? 'desc' : 'asc';
      return;
    }
    this.field = field;
    this.direction = 'asc';
  }

  /** Copia ordenada de `rows`; `valueOf` resuelve el valor de la columna activa. */
  sort<T>(rows: T[], valueOf: (row: T, field: F) => SortValue): T[] {
    const factor = this.direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = this.normalize(valueOf(left, this.field));
      const b = this.normalize(valueOf(right, this.field));
      if (a === undefined && b === undefined) {
        return 0;
      }
      if (a === undefined) {
        return 1;
      }
      if (b === undefined) {
        return -1;
      }
      if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * factor;
      }
      return String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' }) * factor;
    });
  }

  private normalize(value: SortValue): string | number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return value instanceof Date ? value.getTime() : value;
  }
}
