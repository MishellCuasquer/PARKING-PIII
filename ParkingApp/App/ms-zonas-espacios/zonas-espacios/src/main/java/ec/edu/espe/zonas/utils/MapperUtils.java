package ec.edu.espe.zonas.utils;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class MapperUtils {
    public ZonaResponseDto toZonaResponseDto(Zona objZona) {
        if  (objZona == null)
            return null;
        return ZonaResponseDto.builder()
                .id(objZona.getId())
                .nombre(objZona.getNombre())
                .codigo(objZona.getCodigo())
                .descripcion(objZona.getDescripcion())
                .capacidad(objZona.getCapacidad())
                .tipo(objZona.getTipo())
                .activo(objZona.isActivo())
                .fechaCreacion(objZona.getFechaCreacion())
                .fechaActualizacion(objZona.getFechaActualizacion())
                .espacios(objZona.getEspacios() != null ? objZona.getEspacios().size() : 0)
                .build();
    }

    public Zona toZonaEntity(ZonaRequestDto dto) {
        if   (dto == null)
            return null;
        return Zona.builder()
                .nombre(dto.getNombre())
                .descripcion(dto.getDescripcion())
                .capacidad(dto.getCapacidad())
                .tipo(dto.getTipo())
                .build();
    }

    public EspacioResponseDto toEspacioResponseDto(Espacio espacio) {
        if (espacio == null) return null;
        EspacioResponseDto dto = new EspacioResponseDto();
        dto.setId(espacio.getId());
        dto.setNombre(espacio.getNombre());
        dto.setDescripcion(espacio.getDescripcion());
        dto.setTipo(espacio.getZona() != null ? espacio.getZona().getTipo() : null);
               dto.setNombreZona(espacio.getZona() != null ? espacio.getZona().getNombre() : null);
        dto.setFechaCreacion(espacio.getFechaCreacion());
        dto.setFechaActualizacion(espacio.getFechaActualizacion());
        dto.setEstado(espacio.getEstado() != null ? espacio.getEstado().name() : null);
        return dto;
    }

    public Espacio toEspacioEntity(EspacioRequestDto requestDto, Zona zona) {
        if (requestDto == null) return null;
        return Espacio.builder()

                //.tipo(requestDto.getTipo())
                .zona(zona)
                .activo(true)
                .estado(EstadoEspacio.DISPONIBLE)
                .fechaCreacion(LocalDateTime.now())
                .build();
    }
}