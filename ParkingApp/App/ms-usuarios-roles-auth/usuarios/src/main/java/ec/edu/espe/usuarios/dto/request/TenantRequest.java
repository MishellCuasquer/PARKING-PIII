package ec.edu.espe.usuarios.dto.request;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalTime;

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

    // --- Configuración por empresa. Todos opcionales: si vienen a null en un
    // POST se aplica el valor por defecto, y en un PUT se deja el actual sin
    // tocar (así se puede renombrar la empresa sin reenviar la tarifa). ---

    @DecimalMin(value = "0.0", message = "La tarifa no puede ser negativa")
    @DecimalMax(value = "9999.99", message = "La tarifa por hora es demasiado alta")
    private BigDecimal tarifaHora;

    @Pattern(regexp = "^[A-Z]{3}$", message = "La moneda debe ser un código ISO de 3 letras, p. ej. USD")
    private String moneda;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaApertura;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaCierre;
}
