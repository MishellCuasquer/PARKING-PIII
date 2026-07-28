package ec.edu.espe.usuarios.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.espe.usuarios.security.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AuditPublisher {

    private static final Logger log = LoggerFactory.getLogger(AuditPublisher.class);
    private static final String SERVICIO = "ms-usuarios";

    private final CallerContext callerContext;
    private final OutboxRepositorio outboxRepositorio;
    private final OutboxDespachador outboxDespachador;

    // Instancia propia en vez de inyectada: el ObjectMapper de la
    // autoconfiguración no está disponible como bean en este servicio, y para
    // serializar el evento no hace falta ninguna configuración especial.
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void publish(String accion, String entidad, Map<String, Object> datos) {
        publish(accion, entidad, datos, currentUser(), currentTenant());
    }

    /**
     * Variante con usuario/tenant explícitos, para eventos donde el
     * SecurityContext aún no existe (login, registro público): sin esto el
     * evento saldría como "anonymousUser" sin empresa y el ADMIN del tenant
     * no lo vería en su auditoría.
     */
    public void publish(String accion, String entidad, Map<String, Object> datos,
                        String usuario, String tenantId) {
        AuditEvent event = new AuditEvent(
                SERVICIO, accion, entidad, datos, usuario, currentIp(), "N/A", tenantId
        );

        OutboxEvent fila;
        try {
            fila = outboxRepositorio.save(OutboxEvent.builder()
                    .payload(objectMapper.writeValueAsString(event))
                    .creadoEn(LocalDateTime.now())
                    .intentos(0)
                    .build());
        } catch (JsonProcessingException e) {
            log.error("No se pudo serializar el evento de auditoría: {}", e.getMessage());
            return;
        } catch (Exception e) {
            log.error("No se pudo registrar el evento en la outbox: {}", e.getMessage());
            return;
        }

        // El evento ya está a salvo en la outbox: si el envío inmediato falla de
        // cualquier forma, se traga aquí y lo recupera el reintento periódico.
        // Dejar escapar la excepción tumbaría la operación de negocio.
        try {
            if (!outboxDespachador.publicar(fila)) {
                log.warn("Evento {} queda pendiente en la outbox; se reintentará", fila.getId());
            }
        } catch (Exception e) {
            log.warn("Evento {} queda pendiente en la outbox: {}", fila.getId(), e.getMessage());
        }
    }

    // Null para eventos de cuentas globales (superadmin/service) o anónimos (login)
    private String currentTenant() {
        try {
            UUID tenantId = callerContext.callerTenantId();
            return tenantId != null ? tenantId.toString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (auth != null && auth.isAuthenticated()) ? auth.getName() : "system";
    }

    private String currentIp() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attrs.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                return forwarded.split(",")[0].trim();
            }
            String realIp = request.getHeader("X-Real-IP");
            if (realIp != null && !realIp.isBlank()) {
                return realIp;
            }
            return request.getRemoteAddr();
        } catch (IllegalStateException e) {
            return "127.0.0.1";
        }
    }
}
