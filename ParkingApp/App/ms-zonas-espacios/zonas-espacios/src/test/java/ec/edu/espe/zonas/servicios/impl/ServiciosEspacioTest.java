package ec.edu.espe.zonas.servicios.impl;

import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dto.request.EspacioRequestDto;
import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServiciosEspacioTest {

    @Mock
    private EspacioRepositorio espacioRepositorio;
    @Mock
    private ZonaRepositorio zonaRepositorio;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private ServiciosEspacio serviciosEspacio;

    @Test
    void crearEspacio_creaElEspacioCuandoHayCapacidadDisponible() {
        UUID idZona = UUID.randomUUID();
        Zona zona = Zona.builder().id(idZona).codigo("ZON-GEN-01").capacidad(5).build();
        EspacioRequestDto dto = new EspacioRequestDto(null, TipoEspacio.AUTO, idZona);

        when(zonaRepositorio.findByIdForUpdate(idZona)).thenReturn(Optional.of(zona));
        when(espacioRepositorio.countByZonaId(idZona)).thenReturn(0L);
        when(espacioRepositorio.save(any(Espacio.class))).thenAnswer(invocation -> {
            Espacio e = invocation.getArgument(0);
            e.setId(UUID.randomUUID());
            return e;
        });

        EspacioResponseDto result = serviciosEspacio.crearEspacio(dto);

        assertThat(result.getNombre()).isEqualTo("ZON-GEN-ESP-01-001");
        verify(auditPublisher).publish(eq("CREATE"), eq("Espacio"), anyMap());
    }

    @Test
    void crearEspacio_lanzaExcepcionSiSeAlcanzoLaCapacidadMaxima() {
        UUID idZona = UUID.randomUUID();
        Zona zona = Zona.builder().id(idZona).capacidad(1).build();
        EspacioRequestDto dto = new EspacioRequestDto(null, TipoEspacio.AUTO, idZona);

        when(zonaRepositorio.findByIdForUpdate(idZona)).thenReturn(Optional.of(zona));
        when(espacioRepositorio.countByZonaId(idZona)).thenReturn(1L);

        assertThatThrownBy(() -> serviciosEspacio.crearEspacio(dto))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void eliminarEspacio_eliminaYPublicaAuditoria() {
        UUID id = UUID.randomUUID();
        Espacio espacio = Espacio.builder().id(id).nombre("ZON-GEN-ESP-01-001").build();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.of(espacio));

        serviciosEspacio.eliminarEspacio(id.toString());

        verify(espacioRepositorio).delete(espacio);
        verify(auditPublisher).publish(eq("DELETE"), eq("Espacio"), anyMap());
    }

    @Test
    void obtenerEspacio_lanzaExcepcionSiNoExiste() {
        UUID id = UUID.randomUUID();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> serviciosEspacio.obtenerEspacio(id))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void cambiarEstado_actualizaElEstadoYPublicaAuditoria() {
        UUID id = UUID.randomUUID();
        Espacio espacio = Espacio.builder().id(id).nombre("E1").estado(EstadoEspacio.DISPONIBLE).build();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.of(espacio));
        when(espacioRepositorio.save(any(Espacio.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EspacioResponseDto result = serviciosEspacio.cambiarEstado(id, EstadoEspacio.OCUPADO);

        assertThat(result.getEstado()).isEqualTo("OCUPADO");
        verify(auditPublisher).publish(eq("UPDATE"), eq("Espacio"), anyMap());
    }

    @Test
    void reservarEspacio_reservaCuandoEstaDisponible() {
        UUID id = UUID.randomUUID();
        Espacio espacio = Espacio.builder().id(id).nombre("E1").estado(EstadoEspacio.DISPONIBLE).build();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.of(espacio));
        when(espacioRepositorio.save(any(Espacio.class))).thenAnswer(invocation -> invocation.getArgument(0));

        EspacioResponseDto result = serviciosEspacio.reservarEspacio(id);

        assertThat(result.getEstado()).isEqualTo("RESERVADO");
    }

    @Test
    void reservarEspacio_lanzaExcepcionSiNoEstaDisponible() {
        UUID id = UUID.randomUUID();
        Espacio espacio = Espacio.builder().id(id).nombre("E1").estado(EstadoEspacio.OCUPADO).build();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.of(espacio));

        assertThatThrownBy(() -> serviciosEspacio.reservarEspacio(id))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void obtenerEspacios_devuelveTodosLosEspaciosMapeados() {
        Espacio espacio = Espacio.builder().id(UUID.randomUUID()).nombre("E1").estado(EstadoEspacio.DISPONIBLE).build();
        when(espacioRepositorio.findAll()).thenReturn(List.of(espacio));

        List<EspacioResponseDto> result = serviciosEspacio.obtenerEspacios();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getNombre()).isEqualTo("E1");
    }
}
