package ec.edu.espe.zonas.audit;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Publica los eventos que quedaron pendientes en la outbox.
 *
 * Corre cada 10 segundos. Mientras RabbitMQ esté caído los intentos fallan y
 * las filas se quedan donde están; cuando vuelve, el primer barrido las envía
 * todas en orden. Es lo que hace que una caída del broker no pierda eventos.
 */
@Component
@RequiredArgsConstructor
public class OutboxDespachador {

    private static final Logger log = LoggerFactory.getLogger(OutboxDespachador.class);
    private static final int LOTE = 100;

    private final OutboxRepositorio outboxRepositorio;
    private final RabbitTemplate rabbitTemplate;

    @Value("${audit.exchange:exchange_audit}")
    private String exchangeName;

    @Value("${audit.routing-key:routing_audit}")
    private String routingKey;

    @Scheduled(fixedDelayString = "${audit.outbox.intervalo-ms:10000}")
    @Transactional
    public void despacharPendientes() {
        List<OutboxEvent> pendientes = outboxRepositorio.buscarPendientes(PageRequest.of(0, LOTE));
        if (pendientes.isEmpty()) {
            return;
        }

        log.info("Reintentando {} evento(s) pendientes de la outbox", pendientes.size());
        for (OutboxEvent pendiente : pendientes) {
            if (!publicar(pendiente)) {
                // El broker sigue sin responder: no tiene sentido insistir con el resto
                break;
            }
        }
    }

    /**
     * Publica el payload tal cual, sin pasar por el convertidor de mensajes.
     *
     * `convertAndSend` con un String aplicaría el JacksonJsonMessageConverter
     * sobre un texto que YA es JSON, y el consumidor recibiría una cadena
     * escapada (`"{\"servicio\":...}"`) en vez de un objeto: el DTO no validaría
     * y el evento acabaría en la dead-letter queue.
     *
     * @return true si el evento llegó al broker
     */
    boolean publicar(OutboxEvent evento) {
        try {
            MessageProperties props = new MessageProperties();
            props.setContentType(MessageProperties.CONTENT_TYPE_JSON);
            props.setContentEncoding(StandardCharsets.UTF_8.name());
            props.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            Message mensaje = new Message(evento.getPayload().getBytes(StandardCharsets.UTF_8), props);

            rabbitTemplate.send(exchangeName, routingKey, mensaje);
            evento.setEnviadoEn(LocalDateTime.now());
            evento.setUltimoError(null);
            outboxRepositorio.save(evento);
            return true;
        } catch (Exception e) {
            evento.setIntentos(evento.getIntentos() + 1);
            evento.setUltimoError(recortar(e.getMessage()));
            outboxRepositorio.save(evento);
            log.warn("Evento {} sigue pendiente: {}", evento.getId(), e.getMessage());
            return false;
        }
    }

    private String recortar(String mensaje) {
        if (mensaje == null) {
            return "error desconocido";
        }
        return mensaje.length() > 500 ? mensaje.substring(0, 500) : mensaje;
    }

    /**
     * La outbox es un buzón de tránsito, no un histórico: ese vive en ms-audit.
     * Se limpian a diario las filas ya enviadas de más de un día.
     */
    @Scheduled(cron = "${audit.outbox.purga-cron:0 0 3 * * *}")
    @Transactional
    public void purgarEnviados() {
        long borradas = outboxRepositorio.deleteByEnviadoEnBefore(LocalDateTime.now().minusDays(1));
        if (borradas > 0) {
            log.info("Purgadas {} filas de la outbox ya enviadas", borradas);
        }
    }
}
