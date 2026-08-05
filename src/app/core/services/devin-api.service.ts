import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConsolidationOpportunity,
  DuplicateCandidate,
  Invoice,
  InvoiceComparison,
  InvoiceException
} from '../models/invoice.model';

export interface DevinSessionRequest {
  prompt: string;
  title: string;
  tags: string[];
  idempotent: boolean;
  max_acu_limit?: number;
  playbook_id?: string;
  knowledge_ids?: string[];
  secret_ids?: string[];
  structured_output_schema?: Record<string, unknown>;
}

export interface DevinSessionResponse {
  session_id: string;
  url: string;
  is_new_session?: boolean;
}

export interface DevinSessionStatus {
  session_id: string;
  status: 'new' | 'claimed' | 'running' | 'exit' | 'error' | 'suspended' | 'resuming';
  url: string;
  structured_output?: Record<string, unknown> | null;
  pull_requests?: { pr_url: string; pr_state?: string | null }[];
}

/**
 * Cliente de la API de Devin (v3, ambito organizacion).
 *
 * Todas las llamadas salen contra el proxy del backend propio
 * (`${environment.apiUrl}${environment.devin.proxyPath}`), que es quien anade la
 * cabecera `Authorization: Bearer <service user token>` contra api.devin.ai.
 * El token de servicio nunca viaja al navegador.
 */
@Injectable({
  providedIn: 'root'
})
export class DevinApiService {
  constructor(private http: HttpClient) {}

  createSession(request: DevinSessionRequest): Observable<DevinSessionResponse> {
    return this.http.post<DevinSessionResponse>(this.sessionsUrl(), request);
  }

  getSession(sessionId: string): Observable<DevinSessionStatus> {
    return this.http.get<DevinSessionStatus>(`${this.sessionsUrl()}/${sessionId}`);
  }

  sendMessage(sessionId: string, message: string): Observable<unknown> {
    return this.http.post(`${this.sessionsUrl()}/${sessionId}/messages`, { message });
  }

  isConfigured(): Observable<{ configured: boolean }> {
    return this.http.get<{ configured: boolean }>(
      `${environment.apiUrl}${environment.devin.proxyPath}/status`
    );
  }

  /**
   * Crea la sesion desde el backend y la deja vinculada a la excepcion, para que
   * la investigacion quede trazada en la factura y no solo en Devin.
   */
  createSessionForException(
    invoiceId: string,
    exceptionId: string,
    request: DevinSessionRequest
  ): Observable<{ session: DevinSessionResponse; invoice: Invoice }> {
    return this.http.post<{ session: DevinSessionResponse; invoice: Invoice }>(
      `${environment.apiUrl}/invoices/${invoiceId}/exceptions/${exceptionId}/devin-session`,
      request
    );
  }

  /**
   * Caso 1 - Investigacion de duplicado / excepcion de conciliacion.
   * Devin recopila evidencias en ERP, correo y adjuntos, y devuelve un veredicto
   * estructurado que el analista solo tiene que validar.
   */
  buildDuplicateInvestigationRequest(
    invoice: Invoice,
    candidate: DuplicateCandidate,
    exception?: InvoiceException
  ): DevinSessionRequest {
    const prompt = [
      'Contexto: departamento de compras, gestion de facturas de proveedores de tecnologia.',
      `Se ha detectado una excepcion de posible duplicado sobre la factura ${invoice.invoiceNumber} del proveedor ${invoice.supplierName} (NIF ${invoice.supplierTaxId}).`,
      `Factura candidata: ${candidate.candidateInvoiceNumber}. Similitud calculada: ${candidate.score}%. Campos coincidentes: ${candidate.matchedFields.join(', ') || 'ninguno'}.`,
      `Importe total: ${invoice.totalAmount} ${invoice.currency}. Pedido de compra: ${invoice.purchaseOrderNumber ?? 'sin PO'}. Fecha emision: ${this.isoDate(invoice.issueDate)}.`,
      exception ? `Regla disparada: ${exception.ruleCode} (${exception.message}).` : '',
      '',
      'Tarea:',
      '1. Recupera ambas facturas y sus adjuntos del gestor documental y compara conceptos, periodos de servicio, PO y numeros de albaran.',
      '2. Verifica en el ERP si alguna de las dos ya esta contabilizada o pagada.',
      '3. Determina si es duplicado real, refacturacion legitima, abono pendiente o factura distinta.',
      '4. Documenta la evidencia y propone la accion (bloquear pago, liberar, solicitar abono).',
      '',
      'No ejecutes ninguna liberacion de pago ni modifiques datos maestros: la decision final es del aprobador humano.'
    ]
      .filter(Boolean)
      .join('\n');

    return {
      prompt,
      title: `Investigacion duplicado ${invoice.invoiceNumber} vs ${candidate.candidateInvoiceNumber}`,
      tags: ['compras', 'facturas-proveedor', 'duplicados', `invoice:${invoice.invoiceNumber}`],
      idempotent: true,
      max_acu_limit: 10,
      structured_output_schema: {
        type: 'object',
        required: ['verdict', 'confidence', 'evidence', 'recommended_action'],
        properties: {
          verdict: { type: 'string', enum: ['duplicate', 'not_duplicate', 'needs_human_input'] },
          confidence: { type: 'number', minimum: 0, maximum: 100 },
          evidence: { type: 'array', items: { type: 'string' } },
          recommended_action: { type: 'string', enum: ['block_payment', 'release_payment', 'request_credit_note', 'escalate'] },
          notes: { type: 'string' }
        }
      }
    };
  }

  /**
   * Caso 2 - Verificacion del cambio de cuenta bancaria antes de liberar el pago.
   * Devin reune la evidencia (peticion original, contacto verificado, historico
   * del maestro) pero nunca libera el pago.
   */
  buildBankAccountVerificationRequest(invoice: Invoice, exception: InvoiceException): DevinSessionRequest {
    const prompt = [
      'Contexto: control antifraude de pagos a proveedores en el departamento de compras.',
      `La factura ${invoice.invoiceNumber} de ${invoice.supplierName} solicita el cobro en la cuenta ${this.maskIban(invoice.bankAccountIban)}.`,
      `Excepcion detectada: ${exception.ruleCode} - ${exception.message}`,
      `Importe en riesgo: ${invoice.totalAmount} ${invoice.currency}. Vencimiento: ${this.isoDate(invoice.dueDate)}.`,
      '',
      'Tarea:',
      '1. Localiza la peticion de cambio de cuenta (ticket, correo o formulario) y comprueba que el solicitante es un contacto autorizado del proveedor.',
      '2. Compara el titular declarado con el titular registrado en el maestro y con el certificado de titularidad si existe.',
      '3. Revisa el historico de cambios de cuenta del proveedor y si hay senales de suplantacion (dominio de correo distinto, IBAN de pais diferente, cambio proximo al vencimiento).',
      '4. Prepara el guion de verificacion telefonica con el contacto de referencia del maestro (no el del correo entrante).',
      '',
      'Entrega un informe con la evidencia y el nivel de riesgo. La liberacion del pago y la actualizacion del maestro las realiza siempre una persona.'
    ].join('\n');

    return {
      prompt,
      title: `Verificacion cambio de IBAN - ${invoice.supplierName}`,
      tags: ['compras', 'antifraude', 'cambio-iban', `invoice:${invoice.invoiceNumber}`],
      idempotent: true,
      max_acu_limit: 8,
      structured_output_schema: {
        type: 'object',
        required: ['risk_level', 'verification_steps_completed', 'evidence', 'recommended_action'],
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          verification_steps_completed: { type: 'array', items: { type: 'string' } },
          evidence: { type: 'array', items: { type: 'string' } },
          recommended_action: { type: 'string', enum: ['hold_payment', 'request_callback', 'release_after_human_approval', 'escalate_to_fraud'] },
          notes: { type: 'string' }
        }
      }
    };
  }

  /**
   * Caso 3 - Analisis periodico de oportunidades de consolidacion de proveedores.
   * Trabajo analitico, no critico en tiempo real: buen encaje para Devin.
   */
  buildConsolidationAnalysisRequest(opportunities: ConsolidationOpportunity[]): DevinSessionRequest {
    const summary = opportunities
      .slice(0, 10)
      .map(
        opportunity =>
          `- ${opportunity.categoryName}: ${opportunity.supplierNames.join(', ')} | gasto ${opportunity.annualSpend} EUR | ahorro estimado ${opportunity.estimatedSavings} EUR`
      )
      .join('\n');

    const prompt = [
      'Contexto: analisis de gasto de proveedores de tecnologia del departamento de compras.',
      'Categorias con gasto repartido entre varios proveedores:',
      summary || '- sin oportunidades detectadas en el periodo',
      '',
      'Tarea:',
      '1. Cruza el gasto por categoria con los contratos vigentes y sus compromisos de volumen.',
      '2. Identifica solapamientos funcionales reales entre proveedores y servicios redundantes.',
      '3. Cuantifica el ahorro por consolidacion y por alineacion de condiciones de pago, indicando supuestos.',
      '4. Propon un plan de consolidacion priorizado por ahorro/esfuerzo, con riesgos de dependencia de proveedor.',
      '',
      'Entrega un informe ejecutivo en markdown y el detalle estructurado.'
    ].join('\n');

    return {
      prompt,
      title: 'Analisis de oportunidades de consolidacion de proveedores IT',
      tags: ['compras', 'analisis-gasto', 'consolidacion'],
      idempotent: false,
      max_acu_limit: 20,
      structured_output_schema: {
        type: 'object',
        required: ['opportunities'],
        properties: {
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              required: ['category', 'recommended_supplier', 'estimated_annual_savings', 'effort', 'risks'],
              properties: {
                category: { type: 'string' },
                recommended_supplier: { type: 'string' },
                estimated_annual_savings: { type: 'number' },
                effort: { type: 'string', enum: ['low', 'medium', 'high'] },
                risks: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          executive_summary: { type: 'string' }
        }
      }
    };
  }

  /**
   * Caso 4 - Mantenimiento del catalogo de reglas y conectores (tarea de ingenieria).
   * Devin implementa la regla, los tests y el backtesting sobre historico y abre PR.
   */
  buildRuleEngineeringRequest(ruleDescription: string, repo: string): DevinSessionRequest {
    const prompt = [
      `Repositorio: ${repo}.`,
      'Contexto: motor de excepciones de facturas de proveedores (clasificacion de gasto, desviaciones, duplicados y antifraude).',
      `Peticion: ${ruleDescription}`,
      '',
      'Tarea:',
      '1. Implementa la regla en backend/src/modules/invoices/services/invoice-anomaly.service.ts respetando el patron de ToleranceRule (umbral, unidad, severidad, blocksPayment).',
      '2. Anade la regla al perfil de tolerancias del seed (backend/src/seed.ts) y al catalogo documentado.',
      '3. Escribe tests unitarios con casos positivos, negativos y de frontera del umbral.',
      '4. Ejecuta un backtesting sobre el historico de facturas de ejemplo y reporta falsos positivos.',
      '5. Abre un PR con el resumen del impacto en volumen de excepciones.'
    ].join('\n');

    return {
      prompt,
      title: 'Nueva regla de deteccion de anomalias en facturas',
      tags: ['compras', 'motor-reglas', 'ingenieria'],
      idempotent: false,
      max_acu_limit: 30
    };
  }

  private sessionsUrl(): string {
    return `${environment.apiUrl}${environment.devin.proxyPath}/sessions`;
  }

  private isoDate(value: Date | string): string {
    return new Date(value).toISOString().slice(0, 10);
  }

  private maskIban(iban: string): string {
    const clean = (iban ?? '').replace(/\s/g, '').toUpperCase();
    return clean.length > 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : clean;
  }
}
