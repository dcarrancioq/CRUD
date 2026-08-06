import { BadRequestException, Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { ImportedFileFormat } from '../invoice-import.types';

export interface ParsedDocument {
  format: ImportedFileFormat;
  /** Texto plano normalizado: una linea logica del documento por linea. */
  text: string;
  /** Filas de hoja de calculo (vacio en pdf y word), utiles para leer la tabla de lineas. */
  rows: string[][];
}

const EXTENSION_FORMAT: Record<string, ImportedFileFormat> = {
  pdf: 'pdf',
  doc: 'word',
  docx: 'word',
  xls: 'excel',
  xlsx: 'excel',
  xlsm: 'excel',
  csv: 'excel',
};

@Injectable()
export class InvoiceDocumentService {
  async parse(fileName: string, buffer: Buffer): Promise<ParsedDocument> {
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    const format = EXTENSION_FORMAT[extension];
    if (!format) {
      throw new BadRequestException(
        'Formato no soportado. Admitimos PDF, Word (doc/docx) y Excel (xls/xlsx/csv).',
      );
    }

    if (format === 'pdf') {
      return { format, text: await this.readPdf(buffer), rows: [] };
    }
    if (format === 'word') {
      return this.readWord(buffer, extension);
    }
    return this.readSpreadsheet(buffer, extension);
  }

  private async readPdf(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return this.clean(result.text);
    } finally {
      await parser.destroy();
    }
  }

  private async readWord(buffer: Buffer, extension: string): Promise<ParsedDocument> {
    if (extension === 'doc') {
      // .doc binario: mammoth solo lee OOXML, asi que se rescata el texto legible.
      const text = this.clean(
        buffer
          .toString('latin1')
          .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ')
          .replace(/ {2,}/g, ' '),
      );
      return { format: 'word', text, rows: [] };
    }
    const [raw, html] = await Promise.all([
      mammoth.extractRawText({ buffer }),
      mammoth.convertToHtml({ buffer }),
    ]);
    return { format: 'word', text: this.clean(raw.value), rows: this.tableRows(html.value) };
  }

  /** Las tablas de Word se recuperan del HTML: en texto plano cada celda cae en una linea suelta. */
  private tableRows(html: string): string[][] {
    const rows: string[][] = [];
    for (const row of html.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) ?? []).map((cell) =>
        cell
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      if (cells.length) {
        rows.push(cells);
      }
    }
    return rows;
  }

  private async readSpreadsheet(buffer: Buffer, extension: string): Promise<ParsedDocument> {
    const workbook = new Workbook();
    if (extension === 'csv') {
      const rows = buffer
        .toString('utf8')
        .split(/\r?\n/)
        .map((line) => line.split(/[;,\t]/).map((cell) => cell.trim()));
      return { format: 'excel', text: this.clean(rows.map((row) => row.join(' | ')).join('\n')), rows };
    }

    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'No se ha podido leer el Excel. Guarda el fichero como .xlsx y vuelve a intentarlo.',
      );
    }

    const rows: string[][] = [];
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => values.push(this.cellText(cell.value)));
        rows.push(values);
      });
    });

    return {
      format: 'excel',
      text: this.clean(rows.map((row) => row.filter(Boolean).join(' | ')).join('\n')),
      rows,
    };
  }

  private cellText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'object') {
      const candidate = value as { text?: string; result?: unknown; richText?: { text: string }[] };
      if (Array.isArray(candidate.richText)) {
        return candidate.richText.map((part) => part.text).join('');
      }
      if (typeof candidate.text === 'string') {
        return candidate.text;
      }
      if (candidate.result !== undefined && candidate.result !== null) {
        return String(candidate.result);
      }
      return '';
    }
    return String(value);
  }

  private clean(text: string): string {
    return text
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.replace(/\u00a0/g, ' ').replace(/[ \t]{2,}/g, ' ').trim())
      .filter((line) => line.length > 0)
      .join('\n');
  }
}
