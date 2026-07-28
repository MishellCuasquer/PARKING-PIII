package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.config.TenantContext;
import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.excepciones.ConflictoEstadoException;
import ec.edu.espe.zonas.excepciones.RecursoNoEncontradoException;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.EspacioServicio;
import ec.edu.espe.zonas.sse.EspacioEventos;
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
    private static final String ESPACIO_NO_ENCONTRADO = "Espacio no encontrado con id: ";

    @Autowired
    private EspacioRepositorio espacioRepositorio;

    @Autowired
    private ZonaRepositorio zonaRepositorio;

    @Autowired
    private AuditPublisher auditPublisher;

    // required=false + null-check: los tests unitarios instancian el servicio sin este bean
    @Autowired(required = false)
    private EspacioEventos espacioEventos;

    private void emitirEventoSse(String accion, EspacioResponseDto dto, UUID idTenant) {
        if (espacioEventos != null) {
            espacioEventos.publicar(accion, dto, idTenant);
        }
    }

    /**
     * Obtiene el estado general de todos los espacios del parqueadero
     * Llama al repositorio, mapea a DTO y devuelve el listado
     */
    @Override
    public List<EspacioResponseDto> obtenerEspacios() {
        UUID tenantId = TenantContext.currentTenantId();
        List<Espacio> espacios = tenantId != null
                ? espacioRepositorio.findByIdTenant(tenantId)
                : espacioRepositorio.findAll(); // anónimo (monitoreo) ve todo
        return espacios.stream()
                .map(this::mapearEspacioADto)
                .toList();
    }

    // Espacio de otro tenant → mismo error que si no existiera
    private Espacio cargarEspacioDelTenant(UUID id) {
        return verificarTenant(
                espacioRepositorio.findById(id)
                        .orElseThrow(() -> new RecursoNoEncontradoException(ESPACIO_NO_ENCONTRADO + id)),
                id);
    }

    /**
     * Igual que {@link #cargarEspacioDelTenant}, pero tomando el bloqueo de
     * escritura sobre la fila. Solo lo usan las operaciones que van a cambiar el
     * estado: bloquear en las lecturas serializaría el panel entero sin motivo.
     */
    private Espacio cargarEspacioDelTenantParaActualizar(UUID id) {
        return verificarTenant(
                espacioRepositorio.findByIdForUpdate(id)
                        .orElseThrow(() -> new RecursoNoEncontradoException(ESPACIO_NO_ENCONTRADO + id)),
                id);
    }

    private Espacio verificarTenant(Espacio espacio, UUID id) {
        UUID tenantId = TenantContext.currentTenantId();
        if (tenantId != null && !tenantId.equals(espacio.getIdTenant())) {
            throw new RecursoNoEncontradoException(ESPACIO_NO_ENCONTRADO + id);
        }
        return espacio;
    }

    /**
     * Mensaje de rechazo de una transición.
     *
     * Nombra el estado actual porque es la información que necesita quien lo
     * recibe: ms-tickets se la reenvía tal cual al operador, que así sabe si la
     * plaza está ocupada o fuera de servicio.
     */
    private String mensajeTransicionInvalida(Espacio espacio, EstadoEspacio actual, EstadoEspacio destino) {
        if (actual == EstadoEspacio.OCUPADO && destino == EstadoEspacio.MANTENIMIENTO) {
            return "El espacio " + espacio.getNombre() + " tiene un vehículo dentro. "
                    + "Registre la salida antes de ponerlo en mantenimiento.";
        }
        if (destino == EstadoEspacio.OCUPADO) {
            return "El espacio no está disponible (estado: " + actual.name().toLowerCase() + ")";
        }
        return "Transición de estado no permitida para el espacio " + espacio.getNombre()
                + ": " + actual.name().toLowerCase() + " → " + destino.name().toLowerCase();
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
                .orElseThrow(() -> new RecursoNoEncontradoException("Zona no encontrada con id: " + idZona));

        // La zona debe pertenecer al tenant del caller
        UUID tenantId = TenantContext.currentTenantId();
        if (tenantId != null && !tenantId.equals(zona.getIdTenant())) {
            throw new RecursoNoEncontradoException("Zona no encontrada con id: " + idZona);
        }

        // Contar los espacios actuales de forma eficiente
        long cantidadActual = espacioRepositorio.countByZonaId(zona.getId());
        if (cantidadActual >= zona.getCapacidad()) {
            throw new ConflictoEstadoException(
                    "La zona ha alcanzado su capacidad máxima de " + zona.getCapacidad() + " espacios");
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
                .idTenant(zona.getIdTenant())
                .activo(true)
                .fechaCreacion(LocalDateTime.now())
                .build();

        Espacio espacioGuardado = espacioRepositorio.save(nuevoEspacio);

        auditPublisher.publish("CREATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioGuardado.getId(),
                "nombre", espacioGuardado.getNombre()
        ));

        EspacioResponseDto dto = mapearEspacioADto(espacioGuardado);
        emitirEventoSse("CREATE", dto, espacioGuardado.getIdTenant());
        return dto;
    }

    /**
     * Actualiza un espacio existente
     */
    @Override
    @Transactional
    public EspacioResponseDto actualizarEspacio(UUID id, EspacioRequestDto requestDto) {
        // El id viene de la ruta (PUT /api/espacios/{id}), no del cuerpo: el
        // controlador ya lo tenía y antes se descartaba, por eso este método
        // lanzaba siempre y el endpoint devolvía 500.
        // Aislamiento multitenant: no se puede tocar un espacio de otra empresa.
        Espacio espacio = cargarEspacioDelTenant(id);

        // Cambiar el tipo de un espacio OCUPADO dejaría dentro un vehículo que
        // ya no corresponde a la plaza, así que solo se permite si está libre.
        boolean cambiaTipo = requestDto.getTipo() != null
                && !requestDto.getTipo().equals(espacio.getTipo());
        if (cambiaTipo && espacio.getEstado() == EstadoEspacio.OCUPADO) {
            throw new ConflictoEstadoException(
                    "No se puede cambiar el tipo de un espacio ocupado. Registre primero la salida del vehículo.");
        }

        if (requestDto.getTipo() != null) {
            espacio.setTipo(requestDto.getTipo());
        }
        if (requestDto.getDescripcion() != null) {
            espacio.setDescripcion(requestDto.getDescripcion());
        }
        espacio.setFechaActualizacion(LocalDateTime.now());

        Espacio actualizado = espacioRepositorio.save(espacio);

        auditPublisher.publish("UPDATE", ENTIDAD_ESPACIO, Map.of(
                "id", actualizado.getId(),
                "nombre", actualizado.getNombre(),
                "tipo", actualizado.getTipo().name()
        ));

        EspacioResponseDto dto = mapearEspacioADto(actualizado);
        emitirEventoSse("UPDATE", dto, actualizado.getIdTenant());
        return dto;
    }

    /**
     * Elimina un espacio (borrado físico)
     * Si se elimina una zona, también se borran todos sus espacios (CascadeType.ALL)
     */
    @Override
    @Transactional
    public void eliminarEspacio(String id) {
        UUID uuid = UUID.fromString(id);
        Espacio espacio = cargarEspacioDelTenant(uuid);

        EspacioResponseDto dto = mapearEspacioADto(espacio);
        espacioRepositorio.delete(espacio);

        auditPublisher.publish("DELETE", ENTIDAD_ESPACIO, Map.of(
                "id", uuid,
                "nombre", espacio.getNombre()
        ));
        emitirEventoSse("DELETE", dto, espacio.getIdTenant());
    }

    /**
     * Obtiene un espacio específico por su ID
     */
    @Override
    public EspacioResponseDto obtenerEspacio(UUID id) {
        return mapearEspacioADto(cargarEspacioDelTenant(id));
    }

    /**
     * Cambia el estado de un espacio validando que la transición sea legal.
     *
     * La fila se lee con bloqueo pesimista: si dos peticiones intentan ocupar la
     * misma plaza a la vez, la segunda espera, vuelve a leer el estado ya
     * comprometido por la primera y falla con 409 en lugar de sobrescribirla.
     * Sin ese bloqueo ambas leerían DISPONIBLE y las dos creerían haber ganado.
     */
    @Override
    @Transactional
    public EspacioResponseDto cambiarEstado(UUID id, EstadoEspacio estado) {
        Espacio espacio = cargarEspacioDelTenantParaActualizar(id);
        EstadoEspacio estadoActual = espacio.getEstado();

        if (estadoActual != null && !estadoActual.puedeTransicionarA(estado)) {
            throw new ConflictoEstadoException(mensajeTransicionInvalida(espacio, estadoActual, estado));
        }

        actualizarEstadoEspacio(espacio, estado);
        Espacio espacioActualizado = espacioRepositorio.save(espacio);

        auditPublisher.publish("UPDATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioActualizado.getId(),
                "estado", espacioActualizado.getEstado().name()
        ));

        EspacioResponseDto dto = mapearEspacioADto(espacioActualizado);
        emitirEventoSse("UPDATE", dto, espacioActualizado.getIdTenant());
        return dto;
    }

    /**
     * Reserva un espacio disponible cambiando su estado a RESERVADO
     */
    @Override
    @Transactional
    public EspacioResponseDto reservarEspacio(UUID id) {
        Espacio espacio = cargarEspacioDelTenantParaActualizar(id);

        if (espacio.getEstado() != EstadoEspacio.DISPONIBLE) {
            throw new ConflictoEstadoException(
                    "El espacio no está disponible (estado: "
                            + espacio.getEstado().name().toLowerCase() + ")");
        }

        actualizarEstadoEspacio(espacio, EstadoEspacio.RESERVADO);
        Espacio espacioReservado = espacioRepositorio.save(espacio);

        auditPublisher.publish("UPDATE", ENTIDAD_ESPACIO, Map.of(
                "id", espacioReservado.getId(),
                "estado", espacioReservado.getEstado().name()
        ));

        EspacioResponseDto dto = mapearEspacioADto(espacioReservado);
        emitirEventoSse("UPDATE", dto, espacioReservado.getIdTenant());
        return dto;
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
        return listarPorEstadoDelTenant(estado);
    }

    /**
     * Obtiene espacios por estado
     */
    @Override
    public List<EspacioResponseDto> obtenerEspaciosPorEstado(String estado) {
        return listarPorEstadoDelTenant(estado);
    }

    private List<EspacioResponseDto> listarPorEstadoDelTenant(String estado) {
        EstadoEspacio estadoBuscado = EstadoEspacio.valueOf(estado.toUpperCase());
        UUID tenantId = TenantContext.currentTenantId();
        List<Espacio> espacios = tenantId != null
                ? espacioRepositorio.findByEstadoAndIdTenant(estadoBuscado, tenantId)
                : espacioRepositorio.findByEstado(estadoBuscado);
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
        // La zona debe pertenecer al tenant del caller (si tiene)
        UUID tenantId = TenantContext.currentTenantId();
        if (tenantId != null) {
            Zona zona = zonaRepositorio.findById(idZona).orElse(null);
            if (zona == null || !tenantId.equals(zona.getIdTenant())) {
                return List.of();
            }
        }
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
        // Tipo propio del espacio (AUTO/MOTO/...), distinto de la categoria de
        // la zona de arriba. Es lo que usa ms-tickets para no meter un auto en
        // un espacio de moto.
        dto.setTipoEspacio(espacio.getTipo());
        dto.setEstado(espacio.getEstado() != null ? espacio.getEstado().name() : null);
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
        UUID tenantIdActual = TenantContext.currentTenantId();
        List<Espacio> espacios = tenantIdActual != null
                ? espacioRepositorio.findByEstadoAndIdTenant(estadoBuscado, tenantIdActual)
                : espacioRepositorio.findByEstado(estadoBuscado);

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