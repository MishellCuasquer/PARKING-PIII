import { CacheService } from './cache.service';

const redisMock = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => redisMock),
}));

describe('CacheService', () => {
  let service: CacheService;

  const configServiceMock = {
    // devuelve siempre el valor por defecto (TTL 60, localhost:6379)
    get: jest.fn((_key: string, defaultValue?: string) => defaultValue),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CacheService(configServiceMock as never);
  });

  it('get devuelve el valor parseado desde Redis', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ placa: 'ABC-1234' }));

    const result = await service.get<{ placa: string }>('t:1:vehiculo:ABC-1234');

    expect(result).toEqual({ placa: 'ABC-1234' });
    expect(redisMock.get).toHaveBeenCalledWith('t:1:vehiculo:ABC-1234');
  });

  it('get devuelve null cuando la clave no existe', async () => {
    redisMock.get.mockResolvedValue(null);

    expect(await service.get('inexistente')).toBeNull();
  });

  it('get devuelve null sin lanzar cuando Redis falla', async () => {
    redisMock.get.mockRejectedValue(new Error('redis caido'));

    expect(await service.get('clave')).toBeNull();
  });

  it('set escribe el valor con el TTL por defecto', async () => {
    redisMock.set.mockResolvedValue('OK');

    await service.set('clave', { a: 1 });

    expect(redisMock.set).toHaveBeenCalledWith('clave', JSON.stringify({ a: 1 }), 'EX', 60);
  });

  it('set respeta el TTL explícito', async () => {
    redisMock.set.mockResolvedValue('OK');

    await service.set('clave', 'valor', 120);

    expect(redisMock.set).toHaveBeenCalledWith('clave', JSON.stringify('valor'), 'EX', 120);
  });

  it('set no lanza cuando Redis falla', async () => {
    redisMock.set.mockRejectedValue(new Error('redis caido'));

    await expect(service.set('clave', 'valor')).resolves.toBeUndefined();
  });

  it('del elimina la clave', async () => {
    redisMock.del.mockResolvedValue(1);

    await service.del('clave');

    expect(redisMock.del).toHaveBeenCalledWith('clave');
  });

  it('del no lanza cuando Redis falla', async () => {
    redisMock.del.mockRejectedValue(new Error('redis caido'));

    await expect(service.del('clave')).resolves.toBeUndefined();
  });

  it('registra un handler de error para seguir funcionando sin Redis', () => {
    expect(redisMock.on).toHaveBeenCalledWith('error', expect.any(Function));
    const handler = redisMock.on.mock.calls.find((c) => c[0] === 'error')?.[1];

    expect(() => handler(new Error('conexion rechazada'))).not.toThrow();
  });

  it('onModuleDestroy cierra la conexión y tolera fallos', async () => {
    redisMock.quit.mockRejectedValue(new Error('ya cerrada'));

    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
