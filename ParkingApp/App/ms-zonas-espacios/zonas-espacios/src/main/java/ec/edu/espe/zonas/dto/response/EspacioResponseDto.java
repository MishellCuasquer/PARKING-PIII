package ec.edu.espe.zonas.dto.response;


import ec.edu.espe.zonas.entidades.TipoZona;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@AllArgsConstructor
@NoArgsConstructor


public class EspacioResponseDto {

    private UUID id;
    private String nombre;//ZON-VIP-01-001
    private String descripcion;
    private TipoZona tipo;
    private String nombreZona;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
    private String estado;

    // agregado para la zona con los nombres



}
