package ec.edu.espe.usuarios.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantResponse {

    private UUID id;
    private String nombre;
    private String codigo;
    private Boolean activo;

    // Configuración por empresa. Nunca llega a null: el servicio rellena los
    // valores por defecto para las empresas creadas antes de que existieran
    // estas columnas.
    private BigDecimal tarifaHora;
    private String moneda;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaApertura;

    @JsonFormat(pattern = "HH:mm")
    private LocalTime horaCierre;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
