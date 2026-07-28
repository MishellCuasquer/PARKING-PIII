import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Bandeja de salida de eventos de auditoría (patrón outbox).
 *
 * El evento se guarda aquí en la misma base de datos que el dato de negocio,
 * ANTES de intentar publicarlo en RabbitMQ. Si el broker está caído la fila
 * queda pendiente y un reintento periódico la publica cuando vuelve, así que
 * una caída del broker deja de perder eventos.
 *
 * Es la pieza que faltaba: `persistent: true` solo garantiza que el mensaje
 * sobreviva dentro de RabbitMQ, no que llegue a entrar.
 */
@Entity('outbox_event')
export class OutboxEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Evento serializado tal cual se publica en la cola
  @Column({ type: 'text' })
  payload!: string;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn!: Date;

  // NULL mientras esté pendiente de publicar; el índice sirve al barrido periódico
  @Index()
  @Column({ name: 'enviado_en', type: 'timestamp', nullable: true })
  enviadoEn!: Date | null;

  @Column({ name: 'intentos', type: 'int', default: 0 })
  intentos!: number;

  @Column({ name: 'ultimo_error', type: 'text', nullable: true })
  ultimoError!: string | null;
}
