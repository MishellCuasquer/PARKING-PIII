package ec.edu.espe.zonas.sse;

import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Canal SSE (Server-Sent Events) para el panel de espacios: cada cambio de
 * estado se empuja a los clientes suscritos sin necesidad de polling.
 * El evento incluye idTenant para que cada cliente filtre solo su empresa.
 */
@Component
public class EspacioEventos {

    private static final Logger log = LoggerFactory.getLogger(EspacioEventos.class);

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    public SseEmitter suscribir() {
        // 0 = sin timeout: la conexión vive hasta que el cliente la cierre
        SseEmitter emitter = new SseEmitter(0L);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        try {
            // Sin este primer evento la respuesta no se vacía al cliente y
            // EventSource nunca dispara onopen (los headers quedan bufferizados)
            emitter.send(SseEmitter.event().name("init").data("conectado"));
        } catch (Exception e) {
            log.debug("Cliente SSE se desconectó durante el init: {}", e.getMessage());
            emitters.remove(emitter);
        }
        return emitter;
    }

    public void publicar(String accion, EspacioResponseDto espacio, UUID idTenant) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("accion", accion);
        payload.put("espacio", espacio);
        payload.put("idTenant", idTenant != null ? idTenant.toString() : null);

        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("espacio").data(payload));
            } catch (Exception e) {
                log.debug("Cliente SSE desconectado: {}", e.getMessage());
                emitters.remove(emitter);
            }
        }
    }

    public int suscriptores() {
        return emitters.size();
    }
}
