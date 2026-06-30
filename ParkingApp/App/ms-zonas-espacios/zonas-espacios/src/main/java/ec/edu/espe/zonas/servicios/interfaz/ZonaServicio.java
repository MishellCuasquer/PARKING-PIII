package ec.edu.espe.zonas.servicios.interfaz;

import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;

import java.util.List;
import java.util.UUID;

public interface ZonaServicio {

    List<ZonaResponseDto> listarZonas();

    ZonaResponseDto crearZona(ZonaRequestDto requestDto);
    ZonaResponseDto actualizarZona(ZonaRequestDto requestDto);

    ZonaResponseDto actualizarZona(UUID idZona, ZonaRequestDto requestDto);

    void eliminarZona(UUID uuid);

    // Inicializa (crea) espacios para una zona según su capacidad si no existen
    void inicializarEspacios(UUID idZona);

}
