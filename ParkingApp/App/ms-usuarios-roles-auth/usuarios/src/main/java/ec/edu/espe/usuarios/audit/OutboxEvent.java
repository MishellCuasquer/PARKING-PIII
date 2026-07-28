package ec.edu.espe.usuarios.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Bandeja de salida de eventos de auditorÃ­a (patrÃ³n outbox).
 *
 * El evento se persiste aquÃ­ antes de intentar publicarlo en RabbitMQ. Si el
 * broker estÃ¡ caÃ­do la fila queda pendiente y el reintento periÃ³dico la envÃ­a
 * en cuanto vuelve, en lugar de perderse en un `catch` que solo registraba el
 * error en el log.
 */
@Entity
@Table(name = "outbox_event", indexes = @Index(name = "idx_outbox_pendientes", columnList = "enviado_en"))
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Evento serializado a JSON, tal cual se publica en la cola. */
    @Lob
    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "creado_en", nullable = false)
    private LocalDateTime creadoEn;

    /** NULL mientras estÃ© pendiente de publicar. */
    @Column(name = "enviado_en")
    private LocalDateTime enviadoEn;

    @Column(nullable = false)
    private int intentos;

    @Column(name = "ultimo_error", length = 500)
    private String ultimoError;
}
