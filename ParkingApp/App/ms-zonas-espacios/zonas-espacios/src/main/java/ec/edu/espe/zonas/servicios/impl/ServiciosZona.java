package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.TipoEspacio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.servicios.interfaz.ZonaServicio;
import ec.edu.espe.zonas.utils.MapperUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ec.edu.espe.zonas.entidades.TipoZona;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiciosZona implements ZonaServicio {
    private static final String CAMPO_NOMBRE = "nombre";

    private final MapperUtils mapper;

    private final ZonaRepositorio zonaRepositorio;

    private final EspacioRepositorio espacioRepositorio;

    private final AuditPublisher auditPublisher;

    private String generarCodigo(TipoZona tipo) {

        long secuencia = zonaRepositorio.countByTipo(tipo) + 1;

        String prefijo = switch (tipo) {
            case VIP -> "ZON-VIP-";
            case VISITANTES -> "ZON-VIS-";
            case GENERAL -> "ZON-GEN-";
            case PREFERENCIAL -> "ZON-PRE-";
        };

        return prefijo + String.format("%02d", secuencia);
    }

    @Override
    public List<ZonaResponseDto> listarZonas() {
        return zonaRepositorio.findAll().stream()
                .map(z -> {
                    ZonaResponseDto dto = mapper.toZonaResponseDto(z);
                    long cnt = espacioRepositorio.countByZonaId(z.getId());
                    dto.setEspacios((int) cnt);
                    return dto;
                })
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public ZonaResponseDto crearZona(ZonaRequestDto requestDto) {

        if (zonaRepositorio.existsByNombre(requestDto.getNombre())) {
            throw new IllegalArgumentException(
                    "Ya existe una zona con el nombre: " + requestDto.getNombre());
        }

        Zona zona = mapper.toZonaEntity(requestDto);

        zona.setCodigo(generarCodigo(requestDto.getTipo()));
        zona.setActivo(true);

        zona.setFechaCreacion(LocalDateTime.now());
        zona.setFechaActualizacion(LocalDateTime.now());
        Zona zonaSaved = zonaRepositorio.save(zona);

        // Crear espacios automáticamente según capacidad SOLO si el flag está activo
        Boolean crearAuto = requestDto.getCrearEspaciosAutomaticamente();
        System.out.println("DEBUG: crearEspaciosAutomaticamente = " + crearAuto);
        System.out.println("DEBUG: capacidad = " + zonaSaved.getCapacidad());
        
        if (crearAuto != null && crearAuto) {
            int capacidad = zonaSaved.getCapacidad();
            if (capacidad > 0) {
                List<Espacio> nuevos = new ArrayList<>();
                for (int i = 1; i <= capacidad; i++) {
                    String nombreEspacio = zonaSaved.getCodigo() + "-" + String.format("%03d", i);
                    Espacio e = Espacio.builder()
                            .nombre(nombreEspacio)
                            .descripcion(null)
                            .tipo(TipoEspacio.AUTO)
                            .estado(ec.edu.espe.zonas.entidades.EstadoEspacio.DISPONIBLE)
                            .zona(zonaSaved)
                            .activo(true)
                            .fechaCreacion(LocalDateTime.now())
                            .build();
                    nuevos.add(e);
                }
                espacioRepositorio.saveAll(nuevos);
                // Asegurar que las entidades se escriban en la base antes de contar
                espacioRepositorio.flush();
            }
        }

        ZonaResponseDto dto = mapper.toZonaResponseDto(zonaSaved);
        long cnt = espacioRepositorio.countByZonaId(zonaSaved.getId());
        dto.setEspacios((int) cnt);

        auditPublisher.publish("CREATE", "Zona", Map.of(
                "id", zonaSaved.getId(),
                CAMPO_NOMBRE, zonaSaved.getNombre()
        ));

        return dto;
    }

    @Override
    public ZonaResponseDto actualizarZona(ZonaRequestDto requestDto) {
        return null;
    }

    @Override
    public ZonaResponseDto actualizarZona(UUID idZona, ZonaRequestDto requestDto) {

        Zona objZona = zonaRepositorio.findById(idZona)
                .orElseThrow(() ->
                        new RuntimeException("No existe una zona con el id: " + idZona));

        objZona.setNombre(requestDto.getNombre());
        objZona.setDescripcion(requestDto.getDescripcion());
        objZona.setCapacidad(requestDto.getCapacidad());
        objZona.setTipo(requestDto.getTipo());

        Zona zonaActualizada = zonaRepositorio.save(objZona);

        auditPublisher.publish("UPDATE", "Zona", Map.of(
                "id", zonaActualizada.getId(),
                CAMPO_NOMBRE, zonaActualizada.getNombre()
        ));

        return mapper.toZonaResponseDto(zonaActualizada);
    }

    @Override
    @Transactional
    public void eliminarZona(UUID id) {
        Zona zona = zonaRepositorio.findById(id)
                .orElseThrow(() -> new RuntimeException("No existe una zona con el id: " + id));

        // Validar que no haya espacios ocupados
        if (zona.getEspacios() != null && !zona.getEspacios().isEmpty()) {
            long espaciosOcupados = zona.getEspacios().stream()
                    .filter(e -> "OCUPADO".equals(e.getEstado().name()))
                    .count();

            if (espaciosOcupados > 0) {
                throw new RuntimeException(
                        "No se puede eliminar la zona. Hay " + espaciosOcupados + " espacios ocupados");
            }
        }

        zonaRepositorio.deleteById(id);

        auditPublisher.publish("DELETE", "Zona", Map.of(
                "id", id,
                CAMPO_NOMBRE, zona.getNombre()
        ));
    }

    @Override
    @Transactional
    public void inicializarEspacios(UUID idZona) {
        Zona zona = zonaRepositorio.findById(idZona)
                .orElseThrow(() -> new RuntimeException("No existe una zona con el id: " + idZona));

        long cnt = espacioRepositorio.countByZonaId(zona.getId());
        if (cnt > 0) return; // ya inicializado

        int capacidad = zona.getCapacidad();
        List<Espacio> nuevos = new ArrayList<>();
        for (int i = 1; i <= capacidad; i++) {
            Espacio e = Espacio.builder()
                    .nombre(zona.getCodigo() + "-" + String.format("%03d", i))
                    .descripcion(null)
                    .tipo(TipoEspacio.AUTO)
                    .estado(ec.edu.espe.zonas.entidades.EstadoEspacio.DISPONIBLE)
                    .zona(zona)
                    .activo(true)
                    .fechaCreacion(LocalDateTime.now())
                    .build();
            nuevos.add(e);
        }
        espacioRepositorio.saveAll(nuevos);
        espacioRepositorio.flush();
    }


}