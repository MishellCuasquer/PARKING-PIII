package ec.edu.espe.zonas.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

/**
 * Resuelve el tenant de la petición actual:
 * - Usuario normal: claim "tenantId" del JWT.
 * - Cuenta SERVICE (sin tenant propio): header X-Tenant-Id propagado por el microservicio llamante.
 * - Anónimo o cuenta global sin header: null → visibilidad total (dashboard de monitoreo).
 */
public final class TenantContext {

    public static final String TENANT_HEADER = "X-Tenant-Id";

    private TenantContext() {
    }

    public static UUID currentTenantId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
            return null;
        }

        String claim = jwtAuth.getToken().getClaimAsString("tenantId");
        if (claim != null && !claim.isBlank()) {
            return parse(claim);
        }

        boolean isService = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SERVICE".equals(a.getAuthority()));
        if (isService && RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes sra) {
            String header = sra.getRequest().getHeader(TENANT_HEADER);
            if (header != null && !header.isBlank()) {
                return parse(header);
            }
        }
        return null;
    }

    private static UUID parse(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
