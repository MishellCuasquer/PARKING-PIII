import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, LessThan, Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { OutboxEvent } from './entities/outbox-event.entity';

export interface AuditEvent {
  servicio: string;
  accion: string;
  entidad: string;
  datos?: any;
  usuario?: string;
  ip?: string;
  mac?: string;
  tenantId?: string;
}

// Cada cuánto se revisa la bandeja de salida en busca de eventos pendientes
const INTERVALO_REINTENTO_MS = 10_000;
// Cuántos eventos pendientes se publican por barrido
const LOTE_REINTENTO = 100;

/**
 * Publica eventos de auditoría con garantía de no pérdida.
 *
 * El flujo es siempre el mismo: se guarda el evento en la tabla `outbox_event`
 * y solo después se intenta enviarlo. Si el envío funciona, la fila se marca
 * como enviada; si RabbitMQ no está disponible, se queda pendiente y el
 * barrido periódico la reintenta hasta conseguirlo.
 *
 * Se usa un canal con confirmaciones (`createConfirmChannel`): sin ellas
 * `publish()` devuelve true en cuanto el mensaje entra en el buffer local del
 * cliente, que no es lo mismo que haber llegado al broker.
 */
@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);

  private connection: any;
  private channel: any;
  private temporizador?: ReturnType<typeof setInterval>;
  private reintentoEnCurso = false;
  private cerrando = false;
  private readonly exchangeName: string;
  private readonly routingKey: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepository: Repository<OutboxEvent>,
  ) {
    this.exchangeName = this.configService.get<string>('RABBITMQ_EXCHANGE') ?? '';
    this.routingKey = this.configService.get<string>('RABBITMQ_ROUTING_KEY') ?? '';
  }

  async onModuleInit() {
    await this.connect();
    // Al arrancar puede haber eventos de una ejecución anterior sin publicar
    this.temporizador = setInterval(() => {
      void this.reintentarPendientes();
    }, INTERVALO_REINTENTO_MS);
  }

  private async connect(): Promise<boolean> {
    if (this.cerrando) return false;
    try {
      const host = this.configService.get('RABBITMQ_HOST');
      const port = this.configService.get('RABBITMQ_PORT');
      const user = this.configService.get('RABBITMQ_USER');
      const pass = this.configService.get('RABBITMQ_PASSWORD');
      const url = `amqp://${user}:${pass}@${host}:${port}`;

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });

      // Si se cae la conexión hay que descartar el canal: seguir usándolo
      // haría que los publish se perdieran creyendo que salieron.
      this.connection.on('error', () => this.descartarCanal());
      this.connection.on('close', () => this.descartarCanal());

      this.logger.log(`Connected to RabbitMQ at ${url}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to connect to RabbitMQ: ${error}`);
      this.channel = undefined;
      return false;
    }
  }

  private descartarCanal() {
    this.channel = undefined;
    this.connection = undefined;
  }

  /**
   * Guarda el evento y lo intenta publicar de inmediato.
   *
   * Nunca lanza: un fallo de auditoría no puede tumbar la operación de negocio
   * que lo originó. La durabilidad la da la fila de la outbox, no este intento.
   */
  async publishEvent(event: AuditEvent): Promise<void> {
    let registro: OutboxEvent;
    try {
      registro = await this.outboxRepository.save(
        this.outboxRepository.create({ payload: JSON.stringify(event), enviadoEn: null }),
      );
    } catch (error) {
      this.logger.error(`No se pudo registrar el evento en la outbox: ${error}`);
      return;
    }

    if (await this.intentarEnviar(registro)) {
      this.logger.debug(`Evento publicado: ${event.servicio} - ${event.accion} - ${event.entidad}`);
    } else {
      this.logger.warn(
        `Evento ${registro.id} queda pendiente en la outbox; se reintentará en ${
          INTERVALO_REINTENTO_MS / 1000
        }s`,
      );
    }
  }

  /**
   * Publica una fila de la outbox y la marca como enviada.
   *
   * @param manager manager de la transacción del barrido; si se omite, se usa
   *   el repositorio normal (envío inmediato al registrar el evento).
   */
  private async intentarEnviar(
    registro: OutboxEvent,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager ? manager.getRepository(OutboxEvent) : this.outboxRepository;

    if (!this.channel && !(await this.connect())) {
      await this.registrarFallo(registro, 'RabbitMQ no disponible', repo);
      return false;
    }

    try {
      await this.publicarConConfirmacion(registro.payload);
      await repo.update(registro.id, { enviadoEn: new Date(), ultimoError: null });
      return true;
    } catch (error) {
      this.descartarCanal();
      await this.registrarFallo(registro, String(error), repo);
      return false;
    }
  }

  // El broker confirma la recepción antes de dar el envío por bueno
  private publicarConConfirmacion(payload: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.channel.publish(
        this.exchangeName,
        this.routingKey,
        Buffer.from(payload),
        { persistent: true },
        (err: Error | null) => (err ? reject(err) : resolve()),
      );
    });
  }

  private async registrarFallo(
    registro: OutboxEvent,
    motivo: string,
    repo: Repository<OutboxEvent> = this.outboxRepository,
  ): Promise<void> {
    try {
      await repo.increment({ id: registro.id }, 'intentos', 1);
      await repo.update(registro.id, { ultimoError: motivo.slice(0, 500) });
    } catch (error) {
      this.logger.error(`No se pudo actualizar la outbox: ${error}`);
    }
  }

  /**
   * Publica los eventos que quedaron pendientes.
   *
   * Se ordenan por fecha de creación para que la auditoría conserve el orden en
   * que ocurrieron los hechos, no el orden en que se recuperó el broker.
   *
   * Todo el lote va dentro de una transacción que toma las filas con
   * `FOR UPDATE SKIP LOCKED`. El servicio corre con varias réplicas en
   * Kubernetes: sin ese bloqueo, dos pods leerían las mismas filas y
   * publicarían el evento por duplicado. Con SKIP LOCKED cada pod se lleva un
   * lote distinto en vez de esperarse, y el bloqueo se mantiene hasta que las
   * filas quedan marcadas como enviadas.
   */
  private async reintentarPendientes(): Promise<void> {
    if (this.reintentoEnCurso || this.cerrando) return;
    this.reintentoEnCurso = true;
    try {
      await this.outboxRepository.manager.transaction(async (manager) => {
        const pendientes = await manager
          .createQueryBuilder(OutboxEvent, 'outbox')
          .where('outbox.enviado_en IS NULL')
          .orderBy('outbox.creado_en', 'ASC')
          .limit(LOTE_REINTENTO)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();

        if (pendientes.length === 0) return;

        this.logger.log(`Reintentando ${pendientes.length} evento(s) pendientes de la outbox`);
        for (const pendiente of pendientes) {
          if (!(await this.intentarEnviar(pendiente, manager))) {
            // El broker sigue caído: no tiene sentido insistir con el resto del lote
            break;
          }
        }
      });
    } catch (error) {
      this.logger.error(`Error al reintentar la outbox: ${error}`);
    } finally {
      this.reintentoEnCurso = false;
    }
  }

  /**
   * Borra los eventos ya enviados con más de un día de antigüedad.
   * La outbox es un buzón de tránsito; el histórico vive en ms-audit.
   */
  async purgarEnviados(): Promise<void> {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.outboxRepository.delete({ enviadoEn: LessThan(ayer) });
  }

  async onModuleDestroy() {
    this.cerrando = true;
    if (this.temporizador) {
      clearInterval(this.temporizador);
    }
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
    } catch (error) {
      this.logger.debug(`Cierre de RabbitMQ: ${error}`);
    }
  }
}
