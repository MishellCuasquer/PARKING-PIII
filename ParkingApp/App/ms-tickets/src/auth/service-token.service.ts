import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OAuthTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class ServiceTokenService {
  private readonly logger = new Logger(ServiceTokenService.name);
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async getServiceToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const authUrl = this.configService.get<string>(
      'AUTH_TOKEN_URL',
      'http://localhost:8080/api/oauth/token',
    );
    const username = this.configService.get<string>('SERVICE_USERNAME', 'service');
    const password = this.configService.get<string>('SERVICE_PASSWORD', 'service123');

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        username,
        password,
      }),
    });

    if (!response.ok) {
      this.logger.error(`No se pudo obtener token de servicio: ${response.statusText}`);
      throw new Error('Error al obtener token de servicio');
    }

    const data = (await response.json()) as OAuthTokenResponse;
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;

    return this.cachedToken;
  }
}
