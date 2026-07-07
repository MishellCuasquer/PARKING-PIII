import { AuditConsumer } from './audit.consumer';
import * as amqp from 'amqplib';

jest.mock('amqplib');

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let channelMock: any;
  let connectionMock: any;

  const configValues: Record<string, string> = {
    RABBITMQ_HOST: 'localhost',
    RABBITMQ_PORT: '5672',
    RABBITMQ_USER: 'guest',
    RABBITMQ_PASSWORD: 'guest',
    RABBITMQ_QUEUE: 'audit_queue',
    RABBITMQ_EXCHANGE: 'events',
    RABBITMQ_ROUTING_KEY: 'audit.#',
  };
  const configServiceMock = {
    get: jest.fn((key: string) => configValues[key]),
  };
  const auditServiceMock = { create: jest.fn() };

  const eventoValido = {
    servicio: 'ms-vehiculos',
    accion: 'CREATE',
    entidad: 'Vehiculo',
    datos: {},
    usuario: 'system',
    ip: '127.0.0.1',
    mac: 'N/A',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    channelMock = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    connectionMock = {
      createChannel: jest.fn().mockResolvedValue(channelMock),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connectionMock);
    consumer = new AuditConsumer(
      configServiceMock as any,
      auditServiceMock as any,
    );
  });

  it('onModuleInit conecta a RabbitMQ y configura el consumidor con dead-letter', async () => {
    await consumer.onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith(
      'amqp://guest:guest@localhost:5672',
    );
    expect(channelMock.assertExchange).toHaveBeenCalledWith(
      'events',
      'topic',
      { durable: true },
    );
    expect(channelMock.assertExchange).toHaveBeenCalledWith(
      'events.dlx',
      'fanout',
      { durable: true },
    );
    expect(channelMock.assertQueue).toHaveBeenCalledWith('audit_queue.dlq', {
      durable: true,
    });
    expect(channelMock.assertQueue).toHaveBeenCalledWith('audit_queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'events.dlx' },
    });
    expect(channelMock.bindQueue).toHaveBeenCalledWith(
      'audit_queue',
      'events',
      'audit.#',
    );
    expect(channelMock.consume).toHaveBeenCalledWith(
      'audit_queue',
      expect.any(Function),
      { noAck: false },
    );
  });

  describe('procesamiento de mensajes', () => {
    let handler: (msg: any) => Promise<void>;

    beforeEach(async () => {
      await consumer.onModuleInit();
      handler = channelMock.consume.mock.calls[0][1];
    });

    it('guarda el evento y hace ack cuando el mensaje es válido', async () => {
      auditServiceMock.create.mockResolvedValue({ id: '1' });
      const msg = { content: Buffer.from(JSON.stringify(eventoValido)) };

      await handler(msg);

      expect(auditServiceMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ servicio: 'ms-vehiculos', accion: 'CREATE' }),
      );
      expect(channelMock.ack).toHaveBeenCalledWith(msg);
      expect(channelMock.nack).not.toHaveBeenCalled();
    });

    it('hace nack sin reencolar cuando el DTO es inválido', async () => {
      const msg = {
        content: Buffer.from(JSON.stringify({ servicio: 'invalido' })),
      };

      await handler(msg);

      expect(auditServiceMock.create).not.toHaveBeenCalled();
      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channelMock.ack).not.toHaveBeenCalled();
    });

    it('hace nack cuando el mensaje no es JSON válido', async () => {
      const msg = { content: Buffer.from('esto no es json') };

      await handler(msg);

      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('hace nack cuando el guardado falla', async () => {
      auditServiceMock.create.mockRejectedValue(new Error('db caida'));
      const msg = { content: Buffer.from(JSON.stringify(eventoValido)) };

      await handler(msg);

      expect(channelMock.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it('ignora mensajes nulos', async () => {
      await handler(null);

      expect(channelMock.ack).not.toHaveBeenCalled();
      expect(channelMock.nack).not.toHaveBeenCalled();
    });
  });

  it('reintenta la conexión cuando RabbitMQ no está disponible', async () => {
    jest.useFakeTimers();
    (amqp.connect as jest.Mock).mockRejectedValueOnce(new Error('sin red'));

    await consumer.onModuleInit();

    expect(jest.getTimerCount()).toBeGreaterThan(0);
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
