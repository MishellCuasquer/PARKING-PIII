package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dto.request.ZonaRequestDto;
import ec.edu.espe.zonas.dto.response.ZonaResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import ec.edu.espe.zonas.utils.MapperUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiciosZonaTest {

    @Mock
    private MapperUtils mapper;
    @Mock
    private ZonaRepositorio zonaRepositorio;
    @Mock
    private EspacioRepositorio espacioRepositorio;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private ServiciosZona serviciosZona;

    private ZonaRequestDto requestDto() {
        ZonaRequestDto dto = new ZonaRequestDto();
        dto.setNombre("Zona Norte");
        dto.setCapacidad(2);
        dto.setTipo(TipoZona.GENERAL);
        return dto;
    }

    @Test
    void crearZona_creaLaZonaYSusEspaciosSegunCapacidad() {
        ZonaRequestDto dto = requestDto();
        Zona zonaMapeada = Zona.builder().nombre("Zona Norte").tipo(TipoZona.GENERAL).capacidad(2).build();
        Zona zonaGuardada = Zona.builder()
                .id(UUID.randomUUID())
                .nombre("Zona Norte")
                .codigo("ZON-GEN-01")
                .tipo(TipoZona.GENERAL)
                .capacidad(2)
                .build();

        when(zonaRepositorio.existsByNombre("Zona Norte")).thenReturn(false);
        when(mapper.toZonaEntity(dto)).thenReturn(zonaMapeada);
        when(zonaRepositorio.countByTipo(TipoZona.GENERAL)).thenReturn(0L);
        when(zonaRepositorio.save(any(Zona.class))).thenReturn(zonaGuardada);
        when(espacioRepositorio.countByZonaId(zonaGuardada.getId())).thenReturn(2L);
        when(mapper.toZonaResponseDto(zonaGuardada)).thenReturn(ZonaResponseDto.builder().nombre("Zona Norte").build());

        ZonaResponseDto result = serviciosZona.crearZona(dto);

        assertThat(result.getNombre()).isEqualTo("Zona Norte");
        verify(espacioRepositorio).saveAll(org.mockito.ArgumentMatchers.argThat((List<Espacio> lista) -> lista.size() == 2));
        verify(auditPublisher).publish(eq("CREATE"), eq("Zona"), anyMap());
    }

    @Test
    void crearZona_lanzaExcepcionSiElNombreYaExiste() {
        ZonaRequestDto dto = requestDto();
        when(zonaRepositorio.existsByNombre("Zona Norte")).thenReturn(true);

        assertThatThrownBy(() -> serviciosZona.crearZona(dto))
                .isInstanceOf(IllegalArgumentException.class);
        verify(zonaRepositorio, never()).save(any());
    }

    @Test
    void actualizarZona_actualizaCamposYPublicaAuditoria() {
        UUID id = UUID.randomUUID();
        Zona existente = Zona.builder().id(id).nombre("Vieja").tipo(TipoZona.GENERAL).capacidad(1).build();
        ZonaRequestDto dto = requestDto();
        dto.setNombre("Zona Actualizada");

        when(zonaRepositorio.findById(id)).thenReturn(Optional.of(existente));
        when(zonaRepositorio.save(any(Zona.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toZonaResponseDto(any(Zona.class))).thenReturn(ZonaResponseDto.builder().nombre("Zona Actualizada").build());

        ZonaResponseDto result = serviciosZona.actualizarZona(id, dto);

        assertThat(result.getNombre()).isEqualTo("Zona Actualizada");
        verify(auditPublisher).publish(eq("UPDATE"), eq("Zona"), anyMap());
    }

    @Test
    void actualizarZona_lanzaExcepcionSiNoExiste() {
        UUID id = UUID.randomUUID();
        when(zonaRepositorio.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> serviciosZona.actualizarZona(id, requestDto()))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void eliminarZona_eliminaYPublicaAuditoriaCuandoNoHayEspaciosOcupados() {
        UUID id = UUID.randomUUID();
        Zona zona = Zona.builder().id(id).nombre("Zona Vacía").espacios(List.of()).build();
        when(zonaRepositorio.findById(id)).thenReturn(Optional.of(zona));

        serviciosZona.eliminarZona(id);

        verify(zonaRepositorio).deleteById(id);
        verify(auditPublisher).publish(eq("DELETE"), eq("Zona"), anyMap());
    }

    @Test
    void eliminarZona_lanzaExcepcionSiHayEspaciosOcupados() {
        UUID id = UUID.randomUUID();
        Espacio ocupado = Espacio.builder().estado(ec.edu.espe.zonas.entidades.EstadoEspacio.OCUPADO).build();
        Zona zona = Zona.builder().id(id).nombre("Zona Llena").espacios(List.of(ocupado)).build();
        when(zonaRepositorio.findById(id)).thenReturn(Optional.of(zona));

        assertThatThrownBy(() -> serviciosZona.eliminarZona(id))
                .isInstanceOf(RuntimeException.class);
        verify(zonaRepositorio, never()).deleteById(any());
    }
}
