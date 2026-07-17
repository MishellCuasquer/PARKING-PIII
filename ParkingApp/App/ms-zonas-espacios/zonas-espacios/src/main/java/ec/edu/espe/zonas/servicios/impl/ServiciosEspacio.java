package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;

@Service
public class ServiciosEspacio implements EspacioServicio {

    private static final String ENTIDAD_ESPACIO = "Espacio";

    @Autowired
    private EspacioRepositorio espacioRepositorio;

    @Autowired
    private ZonaRepositorio zonaRepositorio;

    @Autowired
    private AuditPublisher auditPublisher;

    /**
     * Obtiene el estado general de todos los espacios del parqueadero
     * Llama al repositorio, mapea a DTO y devuelve el listado
     */
    @Override
    public List<EspacioResponseDto> obtenerEspacios() {
        List<Espacio> espacios = espacioRepositorio.findAll();
        return espacios.stream()
                .map(this::mapearEspacioADto)
                .toList();
    }

    /**
     * Crea un nuevo espacio en una zona específica
     * Valida que no se sobrepase la capacidad de la zona
     * Genera código automático: ZON-VIP-01-001
     */
    @Override
    @Transactional
    public EspacioResponseDto crearEspacio(EspacioRequestDto requestDto) {
        UUID idZona = requestDto.getIdZona();

        // Intentamos obtener la zona con bloqueo pesimista para evitar race conditions
        Zona zona = zonaRepositorio.findByIdForUpdate(idZona)
                .orElseThrow(() -> new RuntimeException("Zona no encontrada con id: " + idZona));

        // Contar los espacios actuales de forma eficiente
        long cantidadActual = espacioRepositorio.countByZonaId(zona.getId());
        if (cantidadActual >= zona.getCapacidad()) {
            throw new RuntimeException("La zona ha alcanzado su capacidad máxima de " + zona.getCapacidad() + " espacios");
        }

        // Generar nombre del espacio: ZON-VIP-01-001. Se avanza hasta el primer
        // nombre libre porque borrar espacios deja huecos y la secuencia por conteo se repetiría
        int secuencia = (int) cantidadActual + 1;
        String nombreEspacio = generarNombreEspacio(zona, secuencia);
        while (espacioRepositorio.existsByNombre(nombreEspacio)) {
            secuencia++;
            nombreEspacio = generarNombreEspacio(zona, secuencia);
        }

        // Crear nuevo espacio
        Espacio nuevoEspacio = Espacio.builder()
                .nombre(nombreEspacio)
                .descripcion(requestDto.getDescripcion())
                .tipo(requestDto.getTipo())
                .estado(EstadoEspacio.DISPONIBLE)
                .zona(zona)
                .activo(true)
                .fechaCreacion(LocalDateTime.now())
                .build();

        Espacio espacioGuardado = espacioRepositorio.save(nuevoEspacio);

        auditPublisher.publish("CREATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioGuardado.getId(),
                "nombre", espacioGuardado.getNombre()
        ));

        return mapearEspacioADto(espacioGuardado);
    }

    /**
     * Actualiza un espacio existente
     */
    @Override
    @Transactional
    public EspacioResponseDto actualizarEspacio(EspacioRequestDto requestDto) {
        // Nota: Se asume que el requestDto contiene el ID del espacio a actualizar
        // Para esto se puede extender el EspacioRequestDto con un campo id
        throw new RuntimeException("Este método requiere que EspacioRequestDto incluya el id del espacio a actualizar");
    }

    /**
     * Elimina un espacio (borrado físico)
     * Si se elimina una zona, también se borran todos sus espacios (CascadeType.ALL)
     */
    @Override
    @Transactional
    public void eliminarEspacio(String id) {
        UUID uuid = UUID.fromString(id);
        Espacio espacio = espacioRepositorio.findById(uuid)
                .orElseThrow(() -> new RuntimeException("Espacio no encontrado con id: " + id));

        espacioRepositorio.delete(espacio);

        auditPublisher.publish("DELETE", ENTIDAD_ESPACIO, Map.of(
                "id", uuid,
                "nombre", espacio.getNombre()
        ));
    }

    /**
     * Obtiene un espacio específico por su ID
     */
    @Override
    public EspacioResponseDto obtenerEspacio(UUID id) {
        Espacio espacio = espacioRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("Espacio no encontrado con id: " + id));
        return mapearEspacioADto(espacio);
    }

    /**
     * Cambiar estado de un espacio: DISPONIBLE a OCUPADO
     */
    @Override
    @Transactional
    public EspacioResponseDto cambiarEstado(UUID id, EstadoEspacio estado) {
        Espacio espacio = espacioRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("Espacio no encontrado con id: " + id));

        actualizarEstadoEspacio(espacio, estado);
        Espacio espacioActualizado = espacioRepositorio.save(espacio);

        auditPublisher.publish("UPDATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioActualizado.getId(),
                "estado", espacioActualizado.getEstado().name()
        ));

        return mapearEspacioADto(espacioActualizado);
    }

    /**
     * Reserva un espacio disponible cambiando su estado a RESERVADO
     */
    @Override
    @Transactional
    public EspacioResponseDto reservarEspacio(UUID id) {
        Espacio espacio = espacioRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("Espacio no encontrado con id: " + id));

        if (espacio.getEstado() != EstadoEspacio.DISPONIBLE) {
            throw new RuntimeException("Solo se pueden reservar espacios en estado DISPONIBLE");
        }

        actualizarEstadoEspacio(espacio, EstadoEspacio.RESERVADO);
        Espacio espacioReservado = espacioRepositorio.save(espacio);

        auditPublisher.publish("UPDATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioReservado.getId(),
                "estado", espacioReservado.getEstado().name()
        ));

        return mapearEspacioADto(espacioReservado);
    }

    /**
     * Actualiza el estado de un espacio en memoria
     */
    private void actualizarEstadoEspacio(Espacio espacio, EstadoEspacio nuevoEstado) {
        espacio.setEstado(nuevoEstado);
        espacio.setFechaActualizacion(LocalDateTime.now());
    }

    /**
     * Obtiene espacios agrupados por estado
     */
    @Override
    public List<EspacioResponseDto> espacioporPorestado(String estado) {
        EstadoEspacio estadoBuscado = EstadoEspacio.valueOf(estado.toUpperCase());
        List<Espacio> espacios = espacioRepositorio.findByEstado(estadoBuscado);
        return espacios.stream()
                .map(this::mapearEspacioADto)
                .toList();
    }

    /**
     * Obtiene espacios por estado
     */
    @Override
    public List<EspacioResponseDto> obtenerEspaciosPorEstado(String estado) {
        EstadoEspacio estadoBuscado = EstadoEspacio.valueOf(estado.toUpperCase());
        List<Espacio> espacios = espacioRepositorio.findByEstado(estadoBuscado);
        return espacios.stream()
                .map(this::mapearEspacioADto)
                .toList();
    }

    /**
     * Obtiene espacios de una zona específica con un estado determinado
     * Envía un espacio a la vez
     */
    @Override
    public List<EspacioResponseDto> obtenerEspaciosPorZonaEstado(UUID idZona, String estado) {
        EstadoEspacio estadoBuscado = EstadoEspacio.valueOf(estado.toUpperCase());
        List<Espacio> espacios = espacioRepositorio.findByZonaIdAndEstado(idZona, estadoBuscado);
        return espacios.stream()
                .map(this::mapearEspacioADto)
                .toList();
    }

    /**
     * Mapea una entidad Espacio a EspacioResponseDto
     */
    private EspacioResponseDto mapearEspacioADto(Espacio espacio) {
        EspacioResponseDto dto = new EspacioResponseDto();
        dto.setId(espacio.getId());
        dto.setNombre(espacio.getNombre());
        dto.setDescripcion(espacio.getDescripcion());
        dto.setTipo(espacio.getZona() != null ? espacio.getZona().getTipo() : null);
        dto.setEstado(espacio.getEstado().name());
        dto.setNombreZona(espacio.getZona() != null ? espacio.getZona().getNombre() : null);
        dto.setFechaCreacion(espacio.getFechaCreacion());
        dto.setFechaActualizacion(espacio.getFechaActualizacion());
        return dto;
    }

    /**
     * Obtiene espacios agrupados por zona según su estado
     * Ej: {"Zona VIP": [...espacios...], "Zona Visitantes": [...espacios...]}
     */
    @Override
    public Map<String, List<EspacioResponseDto>> espaciosPorEstadoAgrupadosPorZona(String estado) {
        EstadoEspacio estadoBuscado = EstadoEspacio.valueOf(estado.toUpperCase());
        List<Espacio> espacios = espacioRepositorio.findByEstado(estadoBuscado);

        Map<String, List<EspacioResponseDto>> resultado = new HashMap<>();

        for (Espacio e : espacios) {
            String zona = e.getZona().getNombre();
            EspacioResponseDto dto = mapearEspacioADto(e);
            resultado.computeIfAbsent(zona, k -> new ArrayList<>()).add(dto);
        }

        return resultado;
    }

    /**
     * Genera el nombre/código del espacio automáticamente
     * Ejemplo: ZON-VIP-ESP-01-001
     * Formato: {PREFIJO_ZONA}-ESP-{NUMERO_ZONA}-{NUMERO_SECUENCIAL_ESPACIO}
     */
    private String generarNombreEspacio(Zona zona, int numeroSequencial) {
        return ec.edu.espe.zonas.utils.MapperUtils.nombreEspacio(zona.getCodigo(), numeroSequencial);
    }
}