import { EventPublisher, AuditEvent } from './event-publisher.service';
import { OutboxEvent } from './entities/outbox-event.entity';
import * as amqp from 'amqplib';

jest.mock('amqplib');

describe('EventPublisher', () => {
  let publisher: EventPublisher;
  let channelMock: any;
  let connectionMock: any;
  let outboxRepositoryMock: any;
  let filaGuardada: OutboxEvent;

  const configValues: Record<string, string> = {
    RABBITMQ_HOST: 'localhost',
    RABBITMQ_PORT: '5672',
    RABBITMQ_USER: 'guest',
    RABBITMQ_PASSWORD: 'guest',
    RABBITMQ_EXCHANGE: 'events',
    RABBITMQ_ROUTING_KEY: 'audit.evento',
  };
  const configServiceMock = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const evento: AuditEvent = {
    servicio: 'ms-vehiculos',
    accion: 'CREATE',
    entidad: 'Vehiculo',
    datos: { placa: 'ABC-1234' },
    usuario: 'system',
    ip: '127.0.0.1',
    mac: 'N/A',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // publish del canal de confirmación invoca el callback sin error
    channelMock = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn((_ex, _rk, _buf, _opts, cb) => cb(null)),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connectionMock = {
      createConfirmChannel: jest.fn().mockResolvedValue(channelMock),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connectionMock);

    filaGuardada = {
      id: 'outbox-1',
      payload: JSON.stringify(evento),
      creadoEn: new Date(),
      enviadoEn: null,
      intentos: 0,
      ultimoError: null,
    };
    outboxRepositoryMock = {
      create: jest.fn((datos) => ({ ...filaGuardada, ...datos })),
      save: jest.fn().mockImplementation(() => Promise.resolve(filaGuardada)),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    publisher = new EventPublisher(configServiceMock as any, outboxRepositoryMock);
  });

  afterEach(async () => {
    await publisher.onModuleDestroy();
  });

  it('onModuleInit conecta y declara el exchange', async () => {
    await publisher.onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith('amqp://guest:guest@localhost:5672');
    expect(connectionMock.createConfirmChannel).toHaveBeenCalled();
    expect(channelMock.assertExchange).toHaveBeenCalledWith('events', 'topic', {
      durable: true,
    });
  });

  it('publishEvent guarda el evento en la outbox antes de publicarlo', async () => {
    await publisher.onModuleInit();

    await publisher.publishEvent(evento);

    expect(outboxRepositoryMock.save).toHaveBeenCalled();
    expect(channelMock.publish).toHaveBeenCalledWith(
      'events',
      'audit.evento',
      Buffer.from(JSON.stringify(evento)),
      { persistent: true },
      expect.any(Function),
    );
  });

  it('marca la fila como enviada cuando el broker confirma', async () => {
    await publisher.onModuleInit();

    await publisher.publishEvent(evento);

    expect(outboxRepositoryMock.update).toHaveBeenCalledWith(
      'outbox-1',
      expect.objectContaining({ enviadoEn: expect.any(Date) }),
    );
  });

  it('conserva el evento pendiente si RabbitMQ no está disponible', async () => {
    (amqp.connect as jest.Mock).mockRejectedValue(new Error('sin red'));
    await publisher.onModuleInit();

    await expect(publisher.publishEvent(evento)).resolves.toBeUndefined();

    // Se guardó en la outbox, pero nunca se marcó como enviada
    expect(outboxRepositoryMock.save).toHaveBeenCalled();
    expect(outboxRepositoryMock.update).not.toHaveBeenCalledWith(
      'outbox-1',
      expect.objectContaining({ enviadoEn: expect.any(Date) }),
    );
    expect(outboxRepositoryMock.increment).toHaveBeenCalled();
  });

  it('publishEvent no propaga los errores del canal', async () => {
    await publisher.onModuleInit();
    channelMock.publish.mockImplementation((_e, _r, _b, _o, cb) => cb(new Error('canal cerrado')));

    await expect(publisher.publishEvent(evento)).resolves.toBeUndefined();
    expect(outboxRepositoryMock.increment).toHaveBeenCalled();
  });

  it('onModuleDestroy cierra canal y conexión', async () => {
    await publisher.onModuleInit();

    await publisher.onModuleDestroy();

    expect(channelMock.close).toHaveBeenCalled();
    expect(connectionMock.close).toHaveBeenCalled();
  });
});
