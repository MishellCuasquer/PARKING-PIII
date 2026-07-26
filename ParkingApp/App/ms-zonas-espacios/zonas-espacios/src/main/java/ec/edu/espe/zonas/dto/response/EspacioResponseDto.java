package ec.edu.espe.zonas.dto.response;


import ec.edu.espe.zonas.entidades.TipoEspacio;
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

    /**
     * OJO: es la categoria de la ZONA (VIP, GENERAL...), no el tipo del
     * espacio. El nombre es historico y el frontend ya lo consume asi, por eso
     * no se renombra.
     */
    private TipoZona tipo;

    /**
     * Tipo de vehiculo para el que sirve el espacio (AUTO, MOTO, BUS...).
     *
     * <p>Estaba en la base de datos pero no se exponia, asi que ms-tickets no
     * podia saber que un espacio era de moto y dejaba entrar un auto. Es el
     * dato con el que se valida la compatibilidad al emitir el ticket.</p>
     */
    private TipoEspacio tipoEspacio;

    private String nombreZona;
    private LocalDateTime fechaCreacion;
    private LocalDateTime fechaActualizacion;
    private String estado;

    // agregado para la zona con los nombres



}
