package ec.edu.espe.usuarios.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Respuesta a una solicitud de recuperacion de contrasena.
 *
 * <p>El mensaje es SIEMPRE el mismo exista o no el correo: si cambiara, el
 * endpoint se convertiria en un oraculo para averiguar que correos estan
 * registrados en la plataforma.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RecuperarPasswordResponse {

    private String mensaje;

    /**
     * Tokens emitidos, uno por cuenta con ese correo (una persona puede tener
     * cuenta en varias empresas). Solo se rellena cuando la propiedad
     * app.password-reset.exponer-token esta activada, que es exclusivamente
     * para desarrollo y demos: en produccion el token viaja por correo y este
     * campo se omite del JSON.
     */
    private List<TokenEmitido> tokens;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TokenEmitido {
        private String username;
        private String empresa;
        private String token;
    }
}
