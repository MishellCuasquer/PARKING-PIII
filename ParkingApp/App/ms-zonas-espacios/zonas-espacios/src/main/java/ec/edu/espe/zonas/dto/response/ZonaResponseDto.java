package ec.edu.espe.zonas.dto.response;

import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@Component
@AllArgsConstructor
@NoArgsConstructor


public class ZonaResponseDto {

    private UUID id;
    private String nombre;
    private String codigo ;
    private String descripcion;
    private int capacidad;
    private TipoZona tipo;
    private boolean activo;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
    private int espacios;

   }

// calcular los espacios disponibles en el DTO
