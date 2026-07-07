import { EventPublisher, AuditEvent } from './event-publisher.service';
import * as amqp from 'amqplib';

jest.mock('amqplib');

describe('EventPublisher', () => {
  let publisher: EventPublisher;
  let channelMock: any;
  let connectionMock: any;

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
    servicio: 'ms-tickets',
    accion: 'CREATE',
    entidad: 'Ticket',
    datos: { placa: 'ABC-1234' },
    usuario: 'system',
    ip: '127.0.0.1',
    mac: 'N/A',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    channelMock = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connectionMock = {
      createChannel: jest.fn().mockResolvedValue(channelMock),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connectionMock);
    publisher = new EventPublisher(configServiceMock as any);
  });

  it('onModuleInit conecta y declara el exchange', async () => {
    await publisher.onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith(
      'amqp://guest:guest@localhost:5672',
    );
    expect(channelMock.assertExchange).toHaveBeenCalledWith(
      'events',
      'topic',
      { durable: true },
    );
  });

  it('publishEvent publica el evento como mensaje persistente', async () => {
    await publisher.onModuleInit();

    await publisher.publishEvent(evento);

    expect(channelMock.publish).toHaveBeenCalledWith(
      'events',
      'audit.evento',
      Buffer.from(JSON.stringify(evento)),
      { persistent: true },
    );
  });

  it('publishEvent no lanza error si el canal no está establecido', async () => {
    await expect(publisher.publishEvent(evento)).resolves.toBeUndefined();
    expect(channelMock.publish).not.toHaveBeenCalled();
  });

  it('publishEvent captura errores del canal sin propagarlos', async () => {
    await publisher.onModuleInit();
    channelMock.publish.mockImplementation(() => {
      throw new Error('canal cerrado');
    });

    await expect(publisher.publishEvent(evento)).resolves.toBeUndefined();
  });

  it('onModuleDestroy cierra canal y conexión', async () => {
    await publisher.onModuleInit();

    await publisher.onModuleDestroy();

    expect(channelMock.close).toHaveBeenCalled();
    expect(connectionMock.close).toHaveBeenCalled();
  });

  it('reintenta la conexión cuando RabbitMQ no está disponible', async () => {
    jest.useFakeTimers();
    (amqp.connect as jest.Mock).mockRejectedValueOnce(new Error('sin red'));

    await publisher.onModuleInit();

    expect(jest.getTimerCount()).toBeGreaterThan(0);
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
