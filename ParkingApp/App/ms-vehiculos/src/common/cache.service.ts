import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;
  private readonly ttlSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.ttlSeconds = Number(this.configService.get<string>('CACHE_TTL_SECONDS', '60'));
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get<string>('REDIS_PORT', '6379')),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Si Redis no está disponible el servicio sigue funcionando sin caché
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis no disponible: ${error.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.warn(`Error al leer cache ${key}: ${error}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds ?? this.ttlSeconds);
    } catch (error) {
      this.logger.warn(`Error al escribir cache ${key}: ${error}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Error al eliminar cache ${key}: ${error}`);
    }
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
