import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class HttpClientService {
  private readonly logger = new Logger(HttpClientService.name);

  async get<T>(url: string, authHeader?: string): Promise<T> {
    const response = await fetch(url, {
      headers: this.buildHeaders(authHeader),
    });
    if (!response.ok) {
      this.logger.error(`GET ${url} failed: ${response.status} ${response.statusText}`);
      throw new Error(`Error fetching ${url}: ${response.statusText}`);
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
      throw new Error(`POST ${url} failed: ${response.statusText}`);
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
      throw new Error(`Error updating ${url}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
  }

  private buildHeaders(authHeader?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) {
      headers.Authorization = authHeader.startsWith('Bearer ')
        ? authHeader
        : `Bearer ${authHeader}`;
    }
    return headers;
  }
}
