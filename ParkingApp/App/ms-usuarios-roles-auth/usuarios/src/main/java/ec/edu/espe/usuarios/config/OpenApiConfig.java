package ec.edu.espe.usuarios.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentacion OpenAPI del microservicio de usuarios, roles y tenants.
 *
 * <p>Se sirve en /swagger-ui.html (UI) y /v3/api-docs (JSON). Ambas rutas estan
 * abiertas en SecurityConfig: sin eso el filtro JWT devolveria 401 y la pagina
 * de documentacion quedaria inaccesible.</p>
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI usuariosOpenAPI() {
        final String esquemaJwt = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Usuarios, Roles y Tenants API")
                        .description(
                                "Microservicio de identidad del parqueadero SaaS multitenant. "
                                        + "Emite los JWT que validan el resto de microservicios y Kong. "
                                        + "El token incluye el claim `tenantId`, que es lo que aisla los "
                                        + "datos de cada empresa: ningun endpoint acepta el tenant por "
                                        + "parametro.")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList(esquemaJwt))
                .components(new Components().addSecuritySchemes(esquemaJwt,
                        new SecurityScheme()
                                .name(esquemaJwt)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description(
                                        "Token obtenido en POST /api/auth/login. "
                                                + "Enviar como: Authorization: Bearer <token>")));
    }
}
