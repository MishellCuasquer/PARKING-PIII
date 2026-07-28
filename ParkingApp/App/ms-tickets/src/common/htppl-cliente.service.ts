import { Injectable, Logger } from '@nestjs/common';

/**
 * Error de una llamada a otro microservicio que conserva el código HTTP y el
 * mensaje del servicio remoto.
 *
 * Sin esto, un 409 de ms-zonas ("el espacio ya está ocupado") llegaba al
 * usuario como un 400 genérico: el motivo real se perdía en el `Error` plano.
 */
export class UpstreamHttpError extends Error {
  constructor(
    readonly status: number,
    readonly detalle: string,
    url: string,
  ) {
    super(`${url} respondió ${status}: ${detalle}`);
    this.name = 'UpstreamHttpError';
  }
}

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  // El cuerpo de error puede ser JSON ({message}) o texto plano según el servicio
  private async extraerDetalle(response: Response): Promise<string> {
    try {
      const texto = await response.text();
      if (!texto) return response.statusText;
      try {
        const json = JSON.parse(texto);
        return json.message ?? json.error ?? texto;
      } catch {
        return texto;
      }
    } catch {
      return response.statusText;
    }
  }

  async get<T>(url: string, authHeader?: string, tenantId?: string | null): Promise<T> {
    const response = await fetch(url, {
      headers: this.buildHeaders(authHeader, tenantId),
    });
    if (!response.ok) {
      this.logger.error(`GET ${url} failed: ${response.status} ${response.statusText}`);
      throw new UpstreamHttpError(response.status, await this.extraerDetalle(response), url);
    }
    return response.json() as Promise<T>;
  }

  async post<T>(url: string, body: unknown, authHeader?: string): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: this.buildHeaders(authHeader),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new UpstreamHttpError(response.status, await this.extraerDetalle(response), url);
    }
    return response.json() as Promise<T>;
  }

  async put<T>(url: string, authHeader?: string): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.buildHeaders(authHeader),
    });
    if (!response.ok) {
      this.logger.error(`PUT ${url} failed: ${response.status} ${response.statusText}`);
      throw new UpstreamHttpError(response.status, await this.extraerDetalle(response), url);
    }
    return response.json() as Promise<T>;
  }

  private buildHeaders(authHeader?: string, tenantId?: string | null): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) {
      headers.Authorization = authHeader.startsWith('Bearer ')
        ? authHeader
        : `Bearer ${authHeader}`;
    }
    // Propaga el tenant del usuario original en llamadas con token de servicio
    if (tenantId) {
      headers['X-Tenant-Id'] = tenantId;
    }
    return headers;
  }
}
