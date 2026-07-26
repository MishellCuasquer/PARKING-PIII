import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceTokenService } from '../auth/service-token.service';
import { CacheService } from './cache.service';

/**
 * Configuración operativa de una empresa (tenant), servida por ms-usuarios.
 * Es lo que hace que dos parqueaderos sobre la misma infraestructura puedan
 * cobrar precios distintos.
 */
export interface TenantConfig {
  tarifaHora: number;
  moneda: string;
  horaApertura: string;
  horaCierre: string;
}

@Injectable()
export class TenantConfigService {
  private readonly logger = new Logger(TenantConfigService.name);
  private readonly tenantsUrl: string;
  private readonly tarifaPorDefecto: number;
  private readonly ttlSegundos: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly cacheService: CacheService,
  ) {
    // MS_TENANTS no está declarado en el compose ni en el ConfigMap: se deriva
    // de MS_PERSONA, que apunta al mismo microservicio. Así añadir la tarifa
    // por tenant no obliga a tocar la configuración de ningún despliegue.
    this.tenantsUrl =
      this.configService.get<string>('MS_TENANTS', '') ||
      this.configService.get<string>('MS_PERSONA', '').replace('/personas', '/tenants');
    this.tarifaPorDefecto = Number(this.configService.get<string>('TARIFA_HORA', '1.0'));
    this.ttlSegundos = Number(this.configService.get<string>('TENANT_CONFIG_TTL_SECONDS', '300'));
  }

  /**
   * Tarifa por hora de la empresa indicada.
   *
   * Nunca lanza: si ms-usuarios no responde o el ticket no tiene tenant
   * (datos anteriores al multitenant), devuelve la tarifa por defecto. Cerrar
   * un ticket es una operación de caja que no puede quedar bloqueada porque
   * otro microservicio esté reiniciándose.
   */
  async getTarifaHora(tenantId: string | null): Promise<number> {
    if (!tenantId) {
      return this.tarifaPorDefecto;
    }

    const config = await this.getConfig(tenantId);
    return config?.tarifaHora ?? this.tarifaPorDefecto;
  }

  async getConfig(tenantId: string): Promise<TenantConfig | null> {
    // TTL de 5 minutos: la tarifa cambia como mucho una vez al mes, pero se
    // consulta en cada salida de vehículo. La clave lleva el tenant delante,
    // igual que el resto del caché, para que dos empresas no colisionen.
    const cacheKey = `t:${tenantId}:config`;

    const cacheado = await this.cacheService.get<TenantConfig>(cacheKey);
    if (cacheado) {
      return cacheado;
    }

    if (!this.tenantsUrl) {
      return null;
    }

    try {
      const token = await this.serviceTokenService.getServiceToken();
      const respuesta = await fetch(`${this.tenantsUrl}/${tenantId}/configuracion`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!respuesta.ok) {
        this.logger.warn(
          `No se pudo leer la configuración del tenant ${tenantId}: ${respuesta.status}`,
        );
        return null;
      }

      const cuerpo = (await respuesta.json()) as Partial<TenantConfig>;
      const config: TenantConfig = {
        tarifaHora: Number(cuerpo.tarifaHora ?? this.tarifaPorDefecto),
        moneda: cuerpo.moneda ?? 'USD',
        horaApertura: cuerpo.horaApertura ?? '00:00',
        horaCierre: cuerpo.horaCierre ?? '23:59',
      };

      await this.cacheService.set(cacheKey, config, this.ttlSegundos);
      return config;
    } catch (error) {
      this.logger.warn(`Error al consultar la configuración del tenant ${tenantId}: ${error}`);
      return null;
    }
  }
}
