import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TenantConfigService } from './tenant-config.service';
import { CacheService } from './cache.service';
import { ServiceTokenService } from '../auth/service-token.service';

describe('TenantConfigService', () => {
  let service: TenantConfigService;

  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const tokenMock = { getServiceToken: jest.fn() };

  const configValues: Record<string, string> = {
    MS_PERSONA: 'http://ms-usuarios/api/personas',
    TARIFA_HORA: '1.5',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheMock.get.mockResolvedValue(null);
    tokenMock.getServiceToken.mockResolvedValue('token-de-servicio');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantConfigService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => configValues[key] ?? def ?? '') },
        },
        { provide: ServiceTokenService, useValue: tokenMock },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<TenantConfigService>(TenantConfigService);
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  const mockFetch = (respuesta: unknown, ok = true, status = 200) => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(respuesta),
    });
  };

  it('sin tenant devuelve la tarifa de respaldo sin llamar a ms-usuarios', async () => {
    mockFetch({});

    await expect(service.getTarifaHora(null)).resolves.toBe(1.5);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('lee la tarifa de la empresa y la guarda en caché', async () => {
    mockFetch({ tarifaHora: 3.25, moneda: 'USD', horaApertura: '06:00', horaCierre: '22:00' });

    await expect(service.getTarifaHora('empresa-1')).resolves.toBe(3.25);

    // La URL de tenants se deriva de MS_PERSONA
    expect(global.fetch).toHaveBeenCalledWith(
      'http://ms-usuarios/api/tenants/empresa-1/configuracion',
      expect.objectContaining({
        headers: { Authorization: 'Bearer token-de-servicio' },
      }),
    );
    expect(cacheMock.set).toHaveBeenCalledWith(
      't:empresa-1:config',
      expect.objectContaining({ tarifaHora: 3.25 }),
      expect.any(Number),
    );
  });

  it('sirve la configuración cacheada sin volver a llamar a ms-usuarios', async () => {
    cacheMock.get.mockResolvedValue({
      tarifaHora: 7,
      moneda: 'USD',
      horaApertura: '00:00',
      horaCierre: '23:59',
    });
    mockFetch({});

    await expect(service.getTarifaHora('empresa-1')).resolves.toBe(7);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Cerrar un ticket es una operación de caja: no puede fallar porque otro
  // microservicio esté caído.
  it('cae a la tarifa de respaldo si ms-usuarios responde con error', async () => {
    mockFetch({}, false, 503);

    await expect(service.getTarifaHora('empresa-1')).resolves.toBe(1.5);
    expect(cacheMock.set).not.toHaveBeenCalled();
  });

  it('cae a la tarifa de respaldo si la petición lanza excepción', async () => {
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('sin red'));

    await expect(service.getTarifaHora('empresa-1')).resolves.toBe(1.5);
  });
});
