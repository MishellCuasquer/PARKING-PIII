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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;
import java.util.Map;
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

    // ---- Aislamiento por tenant (simula un JWT con claim tenantId) ----

    private UUID autenticarConTenant() {
        UUID tenantId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("tenantId", tenantId.toString())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        return tenantId;
    }

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void obtenerEspacios_conTenantSoloConsultaLosDelTenant() {
        UUID tenantId = autenticarConTenant();
        Espacio espacio = Espacio.builder().id(UUID.randomUUID()).nombre("E1")
                .estado(EstadoEspacio.DISPONIBLE).idTenant(tenantId).build();
        when(espacioRepositorio.findByIdTenant(tenantId)).thenReturn(List.of(espacio));

        List<EspacioResponseDto> result = serviciosEspacio.obtenerEspacios();

        assertThat(result).hasSize(1);
        verify(espacioRepositorio).findByIdTenant(tenantId);
    }

    @Test
    void obtenerEspacio_deOtroTenantSeReportaComoNoEncontrado() {
        autenticarConTenant();
        UUID id = UUID.randomUUID();
        Espacio ajeno = Espacio.builder().id(id).nombre("E1").idTenant(UUID.randomUUID()).build();
        when(espacioRepositorio.findById(id)).thenReturn(Optional.of(ajeno));

        assertThatThrownBy(() -> serviciosEspacio.obtenerEspacio(id))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("no encontrado");
    }

    @Test
    void crearEspacio_lanzaSiLaZonaPerteneceAOtroTenant() {
        autenticarConTenant();
        UUID idZona = UUID.randomUUID();
        Zona zonaAjena = Zona.builder().id(idZona).codigo("ZON-GEN-01").capacidad(5)
                .idTenant(UUID.randomUUID()).build();
        EspacioRequestDto dto = new EspacioRequestDto(null, TipoEspacio.AUTO, idZona);
        when(zonaRepositorio.findByIdForUpdate(idZona)).thenReturn(Optional.of(zonaAjena));

        assertThatThrownBy(() -> serviciosEspacio.crearEspacio(dto))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Zona no encontrada");
    }

    @Test
    void obtenerEspaciosPorEstado_conTenantFiltraPorTenant() {
        UUID tenantId = autenticarConTenant();
        Espacio espacio = Espacio.builder().id(UUID.randomUUID()).nombre("E1")
                .estado(EstadoEspacio.DISPONIBLE).idTenant(tenantId).build();
        when(espacioRepositorio.findByEstadoAndIdTenant(EstadoEspacio.DISPONIBLE, tenantId))
                .thenReturn(List.of(espacio));

        List<EspacioResponseDto> result = serviciosEspacio.obtenerEspaciosPorEstado("disponible");

        assertThat(result).hasSize(1);
        verify(espacioRepositorio).findByEstadoAndIdTenant(EstadoEspacio.DISPONIBLE, tenantId);
    }

    @Test
    void obtenerEspaciosPorZonaEstado_devuelveVacioSiLaZonaEsDeOtroTenant() {
        autenticarConTenant();
        UUID idZona = UUID.randomUUID();
        Zona zonaAjena = Zona.builder().id(idZona).idTenant(UUID.randomUUID()).build();
        when(zonaRepositorio.findById(idZona)).thenReturn(Optional.of(zonaAjena));

        List<EspacioResponseDto> result =
                serviciosEspacio.obtenerEspaciosPorZonaEstado(idZona, "DISPONIBLE");

        assertThat(result).isEmpty();
    }

    @Test
    void obtenerEspaciosPorZonaEstado_devuelveLosEspaciosDeLaZonaPropia() {
        UUID tenantId = autenticarConTenant();
        UUID idZona = UUID.randomUUID();
        Zona zonaPropia = Zona.builder().id(idZona).idTenant(tenantId).build();
        Espacio espacio = Espacio.builder().id(UUID.randomUUID()).nombre("E1")
                .estado(EstadoEspacio.DISPONIBLE).zona(zonaPropia).build();
        when(zonaRepositorio.findById(idZona)).thenReturn(Optional.of(zonaPropia));
        when(espacioRepositorio.findByZonaIdAndEstado(idZona, EstadoEspacio.DISPONIBLE))
                .thenReturn(List.of(espacio));

        List<EspacioResponseDto> result =
                serviciosEspacio.obtenerEspaciosPorZonaEstado(idZona, "DISPONIBLE");

        assertThat(result).hasSize(1);
    }

    @Test
    void espaciosPorEstadoAgrupadosPorZona_agrupaPorNombreDeZona() {
        UUID tenantId = autenticarConTenant();
        Zona zona = Zona.builder().id(UUID.randomUUID()).nombre("Zona VIP").idTenant(tenantId).build();
        Espacio e1 = Espacio.builder().id(UUID.randomUUID()).nombre("E1")
                .estado(EstadoEspacio.DISPONIBLE).zona(zona).build();
        Espacio e2 = Espacio.builder().id(UUID.randomUUID()).nombre("E2")
                .estado(EstadoEspacio.DISPONIBLE).zona(zona).build();
        when(espacioRepositorio.findByEstadoAndIdTenant(EstadoEspacio.DISPONIBLE, tenantId))
                .thenReturn(List.of(e1, e2));

        Map<String, List<EspacioResponseDto>> result =
                serviciosEspacio.espaciosPorEstadoAgrupadosPorZona("DISPONIBLE");

        assertThat(result).containsOnlyKeys("Zona VIP");
        assertThat(result.get("Zona VIP")).hasSize(2);
    }
}
