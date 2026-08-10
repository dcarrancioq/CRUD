import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { InvoiceComparison, InvoiceComparisonField } from '../../../../core/models/invoice.model';
import { SearchableOption } from '../../../../shared/components/searchable-select/searchable-select.component';
import { DevinApiService, DevinSessionStatus } from '../../../../core/services/devin-api.service';
import { InvoiceOption, InvoiceService } from '../../../../core/services/invoice.service';

type InvestigationState = 'launching' | 'running' | 'done' | 'unavailable' | 'error';

interface InvestigationFindings {
  verdict: string;
  confidence?: number;
  evidence: string[];
  recommendedAction: string;
  notes?: string;
}

const VERDICT_LABELS: Record<string, string> = {
  duplicate: 'Es un duplicado real',
  not_duplicate: 'No es un duplicado',
  needs_human_input: 'No concluyente: requiere revision humana'
};

const ACTION_LABELS: Record<string, string> = {
  block_payment: 'Bloquear el pago',
  release_payment: 'Liberar el pago tras aprobacion humana',
  request_credit_note: 'Solicitar abono al proveedor',
  escalate: 'Escalar al responsable de compras'
};

@Component({
  selector: 'app-invoice-compare',
  templateUrl: './invoice-compare.component.html',
  styleUrls: ['./invoice-compare.component.css']
})
export class InvoiceCompareComponent implements OnInit, OnDestroy {
  invoiceOptions: SearchableOption[] = [];
  leftId = '';
  rightId = '';
  comparison?: InvoiceComparison;
  onlyDifferences = false;

  investigationOpen = false;
  investigationState: InvestigationState = 'launching';
  investigationMessage = '';
  investigationPlan: string[] = [];
  investigationSessionUrl = '';
  findings?: InvestigationFindings;

  private pollSubscription?: Subscription;
  private readonly searchTerm = new Subject<string>();
  private readonly knownOptions = new Map<string, SearchableOption>();

  constructor(
    private invoiceService: InvoiceService,
    private devinApi: DevinApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;

    // Con miles de facturas el desplegable no las carga todas: busca en el backend
    // segun el texto que escribe el usuario.
    this.searchTerm
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.invoiceService.getOptions(term))
      )
      .subscribe(options => this.applyOptions(options));

    this.invoiceService.getOptions().subscribe(options => {
      if (!this.leftId && options.length) {
        this.leftId = params['left'] ?? options[0].id;
        this.rightId = params['right'] ?? (options.length > 1 ? options[1].id : options[0].id);
        this.compare();
      }
      this.applyOptions(options);
    });
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }

  onInvoiceSearch(term: string): void {
    this.searchTerm.next(term);
  }

  compare(): void {
    this.closeInvestigation();
    if (!this.leftId || !this.rightId || this.leftId === this.rightId) {
      this.comparison = undefined;
      return;
    }
    this.invoiceService
      .compare(this.leftId, this.rightId)
      .subscribe(comparison => (this.comparison = comparison));
  }

  get visibleFields(): InvoiceComparisonField[] {
    const fields = this.comparison?.fields ?? [];
    return this.onlyDifferences ? fields.filter(field => !field.equal) : fields;
  }

  get verdictLabel(): string {
    switch (this.comparison?.duplicateVerdict) {
      case 'likely_duplicate':
        return 'Duplicado muy probable: bloquear pago';
      case 'needs_review':
        return 'Revision manual necesaria';
      default:
        return 'Facturas distintas';
    }
  }

  get fraudSignals(): InvoiceComparisonField[] {
    return (this.comparison?.fields ?? []).filter(field => field.relevance === 'fraud_signal' && !field.equal);
  }

  swap(): void {
    const previousLeft = this.leftId;
    this.leftId = this.rightId;
    this.rightId = previousLeft;
    this.compare();
  }

  /**
   * Lanza la investigacion asistida por IA sobre las dos facturas comparadas y
   * muestra la conclusion en lenguaje natural, sin exponer el payload tecnico.
   */
  investigateWithAi(): void {
    if (!this.comparison) {
      return;
    }
    const { left, right, duplicateScore, matchedFields } = this.comparison;

    this.investigationOpen = true;
    this.investigationState = 'launching';
    this.investigationMessage = '';
    this.investigationSessionUrl = '';
    this.findings = undefined;
    this.investigationPlan = [
      `Comparar los documentos y adjuntos de ${left.invoiceNumber} y ${right.invoiceNumber}.`,
      'Comprobar en el ERP si alguna de las dos ya esta contabilizada o pagada.',
      'Distinguir entre duplicado real, refacturacion legitima o factura distinta.',
      'Proponer la accion de pago, dejando la decision final a una persona.'
    ];

    const request = this.devinApi.buildDuplicateInvestigationRequest(left, {
      invoiceId: left.id,
      candidateInvoiceId: right.id,
      candidateInvoiceNumber: right.invoiceNumber,
      score: duplicateScore,
      matchedFields,
      reason: `Comparativa manual desde la pantalla de conciliacion (${matchedFields.join(', ')})`
    });

    this.pollSubscription?.unsubscribe();
    this.devinApi.createSession(request).subscribe({
      next: session => {
        this.investigationSessionUrl = session.url;
        this.investigationState = 'running';
        this.pollSession(session.session_id);
      },
      error: error => {
        const status: number = error?.status ?? 0;
        this.investigationState = status === 503 ? 'unavailable' : 'error';
        this.investigationMessage =
          status === 503
            ? 'La integracion con la IA no esta configurada en el servidor (falta el usuario de servicio). La comparativa determinista de esta pantalla sigue siendo valida para decidir.'
            : 'No se ha podido lanzar la investigacion. Reintentalo o revisa el estado de la integracion.';
      }
    });
  }

  closeInvestigation(): void {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = undefined;
    this.investigationOpen = false;
  }

  /**
   * Las opciones que ya estan seleccionadas se conservan aunque dejen de cumplir el
   * filtro, para que el desplegable siga mostrando la factura elegida.
   */
  private applyOptions(options: InvoiceOption[]): void {
    options.forEach(option => this.knownOptions.set(option.id, this.toOption(option)));
    const selected = [this.leftId, this.rightId]
      .filter(id => id && !options.some(option => option.id === id))
      .map(id => this.knownOptions.get(id))
      .filter((option): option is SearchableOption => !!option);
    this.invoiceOptions = [...selected, ...options.map(option => this.toOption(option))];
  }

  private toOption(invoice: InvoiceOption): SearchableOption {
    return {
      value: invoice.id,
      label: `${invoice.invoiceNumber} - ${invoice.supplierName}`,
      hint: `${invoice.issueDate} | ${invoice.totalAmount} ${invoice.currency}`
    };
  }

  private pollSession(sessionId: string): void {
    this.pollSubscription = interval(5000)
      .pipe(switchMap(() => this.devinApi.getSession(sessionId)))
      .subscribe({
        next: status => this.applySessionStatus(status),
        error: () => {
          this.investigationState = 'error';
          this.investigationMessage = 'Se ha perdido el seguimiento de la investigacion.';
        }
      });
  }

  private applySessionStatus(status: DevinSessionStatus): void {
    if (status.url) {
      this.investigationSessionUrl = status.url;
    }
    const output = status.structured_output;
    if (output) {
      this.findings = this.toFindings(output);
      this.investigationState = 'done';
      this.pollSubscription?.unsubscribe();
      return;
    }
    if (status.status === 'exit' || status.status === 'error') {
      this.investigationState = status.status === 'error' ? 'error' : 'done';
      this.investigationMessage =
        status.status === 'error'
          ? 'La investigacion ha terminado con error antes de emitir conclusiones.'
          : 'La investigacion ha finalizado sin conclusiones estructuradas. Revisa el detalle de la sesion.';
      this.pollSubscription?.unsubscribe();
    }
  }

  private toFindings(output: Record<string, unknown>): InvestigationFindings {
    const verdict = typeof output['verdict'] === 'string' ? (output['verdict'] as string) : '';
    const action =
      typeof output['recommended_action'] === 'string' ? (output['recommended_action'] as string) : '';
    const confidence = typeof output['confidence'] === 'number' ? (output['confidence'] as number) : undefined;
    const evidence = Array.isArray(output['evidence'])
      ? (output['evidence'] as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];
    const notes = typeof output['notes'] === 'string' ? (output['notes'] as string) : undefined;

    return {
      verdict: VERDICT_LABELS[verdict] ?? 'Conclusion no reconocida',
      confidence,
      evidence,
      recommendedAction: ACTION_LABELS[action] ?? 'Sin accion recomendada',
      notes
    };
  }
}
