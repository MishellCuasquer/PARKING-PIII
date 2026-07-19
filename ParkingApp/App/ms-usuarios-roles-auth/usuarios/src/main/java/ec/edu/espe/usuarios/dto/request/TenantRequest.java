package ec.edu.espe.usuarios.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class TenantRequest {

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre debe tener máximo 100 caracteres")
    private String nombre;

    @NotBlank(message = "El código es obligatorio")
    @Size(max = 20, message = "El código debe tener máximo 20 caracteres")
    @Pattern(regexp = "^[A-Z0-9-]+$", message = "El código solo admite mayúsculas, números y guiones")
    private String codigo;

    private Boolean activo;
}
