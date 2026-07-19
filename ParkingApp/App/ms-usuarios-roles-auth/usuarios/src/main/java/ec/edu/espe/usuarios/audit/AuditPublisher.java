package ec.edu.espe.usuarios.audit;

import ec.edu.espe.usuarios.security.CallerContext;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AuditPublisher {

    private static final Logger log = LoggerFactory.getLogger(AuditPublisher.class);
    private static final String SERVICIO = "ms-usuarios";

    private final RabbitTemplate rabbitTemplate;
    private final CallerContext callerContext;

    @Value("${audit.exchange:exchange_audit}")
    private String exchangeName;

    @Value("${audit.routing-key:routing_audit}")
    private String routingKey;

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
        try {
            rabbitTemplate.convertAndSend(exchangeName, routingKey, event);
        } catch (Exception e) {
            log.error("Failed to publish audit event: {}", e.getMessage());
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
