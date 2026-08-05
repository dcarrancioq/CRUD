import { HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateDevinSessionDto } from './dto/create-devin-session.dto';

export interface DevinSessionResponse {
  session_id: string;
  url: string;
  status?: string;
  is_new_session?: boolean;
}

/**
 * Unico punto del sistema que conoce el token del usuario de servicio de Devin.
 * El navegador llama a `/api/integrations/devin/*` y es este servicio el que
 * añade la cabecera Authorization contra api.devin.ai.
 */
@Injectable()
export class DevinService {
  private readonly logger = new Logger(DevinService.name);

  constructor(private readonly config: ConfigService) {}

  async createSession(dto: CreateDevinSessionDto): Promise<DevinSessionResponse> {
    return this.request<DevinSessionResponse>('POST', `/v3/organizations/${this.orgId()}/sessions`, dto);
  }

  async getSession(sessionId: string): Promise<unknown> {
    return this.request('GET', `/v3/organizations/${this.orgId()}/sessions/${sessionId}`);
  }

  async sendMessage(sessionId: string, message: string): Promise<unknown> {
    return this.request('POST', `/v3/organizations/${this.orgId()}/sessions/${sessionId}/messages`, {
      message,
    });
  }

  isConfigured(): boolean {
    return !!this.config.get<string>('DEVIN_SERVICE_TOKEN') && !!this.config.get<string>('DEVIN_ORG_ID');
  }

  private orgId(): string {
    const orgId = this.config.get<string>('DEVIN_ORG_ID');
    if (!orgId) {
      throw new ServiceUnavailableException(
        'Integracion con Devin no configurada: falta DEVIN_ORG_ID en el backend',
      );
    }
    return orgId;
  }

  private token(): string {
    const token = this.config.get<string>('DEVIN_SERVICE_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException(
        'Integracion con Devin no configurada: falta DEVIN_SERVICE_TOKEN en el backend',
      );
    }
    return token;
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const baseUrl = this.config.get<string>('DEVIN_API_BASE_URL', 'https://api.devin.ai');
    const token = this.token();

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = await response.text();
    if (!response.ok) {
      this.logger.error(`Devin API ${method} ${path} -> ${response.status}`);
      throw new HttpException(
        { message: 'Error llamando a la API de Devin', detail: payload },
        response.status,
      );
    }
    return (payload ? JSON.parse(payload) : {}) as T;
  }
}
