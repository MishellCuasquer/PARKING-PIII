package ec.edu.espe.zonas.servicios.interfaz;

import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.EstadoEspacio;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface EspacioServicio {

    List<EspacioResponseDto> obtenerEspacios();

    EspacioResponseDto crearEspacio(EspacioRequestDto requestDto);

    EspacioResponseDto actualizarEspacio(EspacioRequestDto requestDto);

    void eliminarEspacio(String id);

    EspacioResponseDto obtenerEspacio(UUID id);

    EspacioResponseDto cambiarEstado(UUID id, EstadoEspacio estado);

    EspacioResponseDto reservarEspacio(UUID id);

    List<EspacioResponseDto> espacioporPorestado(String estado);

    List<EspacioResponseDto> obtenerEspaciosPorEstado(String estado);

    List<EspacioResponseDto> obtenerEspaciosPorZonaEstado(UUID id, String estado);

    // Se agrega el map para agrupar espacios por estado y por zona
    Map<String, List<EspacioResponseDto>> espaciosPorEstadoAgrupadosPorZona(String estado);
}