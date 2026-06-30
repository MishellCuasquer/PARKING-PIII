package ec.edu.espe.zonas.dto.request;

import ec.edu.espe.zonas.entidades.TipoZona;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ZonaRequestDto {

    @NotNull(message = "El nombre de la zona es obligatorio")
    @NotBlank(message = "El nombre de la zona no puede estar vacío")
    @Size(max = 100, message = "El nombre de la zona no puede tener más de 100 caracteres")
    private String nombre;

    private String descripcion;

    @NotNull(message = "La capacidad es un campo obligatorio")
    @Min(value = 1, message = "La capacidad debe ser un numero positivo")
    @Max(value = 1000, message = "La capacidad no puede ser mayor a 1000")
    private Integer capacidad;

    @NotNull(message = "El tipo de zona es obligatorio")
    private TipoZona tipo;
}