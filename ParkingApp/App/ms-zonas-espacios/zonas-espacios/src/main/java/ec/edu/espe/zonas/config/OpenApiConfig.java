package ec.edu.espe.zonas.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Documentacion OpenAPI del microservicio de zonas y espacios.
 *
 * <p>Ojo con /api/espacios/stream: Swagger lo documenta como un GET normal,
 * pero es un stream Server-Sent Events que no termina. Probarlo desde el boton
 * "Try it out" deja la peticion colgada; hay que usar un EventSource.</p>
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI zonasOpenAPI() {
        final String esquemaJwt = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Zonas y Espacios API")
                        .description(
                                "Microservicio de distribucion fisica del parqueadero: zonas, "
                                        + "espacios, estados de ocupacion y el stream SSE "
                                        + "/api/espacios/stream que alimenta el dashboard en tiempo "
                                        + "real. Los GET de listado son publicos (los consume el "
                                        + "dashboard de monitoreo sin token); el resto exige JWT y "
                                        + "filtra por el tenant del token.")
                        .version("1.0"))
                .addSecurityItem(new SecurityRequirement().addList(esquemaJwt))
                .components(new Components().addSecuritySchemes(esquemaJwt,
                        new SecurityScheme()
                                .name(esquemaJwt)
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description(
                                        "Token obtenido en POST /api/auth/login de ms-usuarios.")));
    }
}
