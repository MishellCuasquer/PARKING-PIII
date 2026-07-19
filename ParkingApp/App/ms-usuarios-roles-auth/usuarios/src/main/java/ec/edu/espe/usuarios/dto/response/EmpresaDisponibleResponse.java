package ec.edu.espe.usuarios.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Una empresa en la que la persona autenticada (mismo email + dni) tiene cuenta.
 * Alimenta la pantalla "Mis empresas" para cambiar de contexto sin re-login.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmpresaDisponibleResponse {

    private UUID tenantId;
    private String tenantNombre;
    private String tenantCodigo;
    private String username;
    private List<String> roles;
    private boolean actual;
}
