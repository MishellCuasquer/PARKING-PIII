package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.TenantRequest;
import ec.edu.espe.usuarios.dto.response.TenantResponse;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.repository.TenantRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

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
class TenantServiceImplTest {

    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private TenantServiceImpl tenantService;

    private Tenant tenant(UUID id, String nombre, String codigo, boolean activo) {
        return Tenant.builder().id(id).nombre(nombre).codigo(codigo).activo(activo).build();
    }

    @Test
    void create_guardaConCodigoEnMayusculasYPublicaAuditoria() {
        TenantRequest request = new TenantRequest();
        request.setNombre("Parqueadero Norte");
        request.setCodigo("norte");

        when(tenantRepository.existsByCodigo("NORTE")).thenReturn(false);
        when(tenantRepository.existsByNombre("Parqueadero Norte")).thenReturn(false);
        when(tenantRepository.save(any(Tenant.class)))
                .thenAnswer(inv -> {
                    Tenant t = inv.getArgument(0);
                    t.setId(UUID.randomUUID());
                    return t;
                });

        TenantResponse response = tenantService.create(request);

        assertThat(response.getCodigo()).isEqualTo("NORTE");
        assertThat(response.getNombre()).isEqualTo("Parqueadero Norte");
        assertThat(response.getActivo()).isTrue();
        verify(auditPublisher).publish(eq("CREATE"), eq("Tenant"), anyMap());
    }

    @Test
    void create_lanza409SiElCodigoYaExiste() {
        TenantRequest request = new TenantRequest();
        request.setNombre("Otro");
        request.setCodigo("norte");
        when(tenantRepository.existsByCodigo("NORTE")).thenReturn(true);

        assertThatThrownBy(() -> tenantService.create(request))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void create_lanza409SiElNombreYaExiste() {
        TenantRequest request = new TenantRequest();
        request.setNombre("Parqueadero Norte");
        request.setCodigo("N2");
        when(tenantRepository.existsByCodigo("N2")).thenReturn(false);
        when(tenantRepository.existsByNombre("Parqueadero Norte")).thenReturn(true);

        assertThatThrownBy(() -> tenantService.create(request))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void getAll_devuelveTodosLosTenants() {
        when(tenantRepository.findAll()).thenReturn(List.of(
                tenant(UUID.randomUUID(), "Norte", "NORTE", true),
                tenant(UUID.randomUUID(), "Sur", "SUR", false)));

        List<TenantResponse> result = tenantService.getAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(1).getActivo()).isFalse();
    }

    @Test
    void getPublicos_devuelveSoloActivos() {
        when(tenantRepository.findByActivoTrue()).thenReturn(List.of(
                tenant(UUID.randomUUID(), "Norte", "NORTE", true)));

        List<TenantResponse> result = tenantService.getPublicos();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getCodigo()).isEqualTo("NORTE");
    }

    @Test
    void getById_lanza404SiNoExiste() {
        UUID id = UUID.randomUUID();
        when(tenantRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> tenantService.getById(id))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void update_actualizaNombreCodigoYActivo() {
        UUID id = UUID.randomUUID();
        Tenant existente = tenant(id, "Norte", "NORTE", true);
        TenantRequest request = new TenantRequest();
        request.setNombre("Norte Renovado");
        request.setCodigo("norte2");
        request.setActivo(false);

        when(tenantRepository.findById(id)).thenReturn(Optional.of(existente));
        when(tenantRepository.findByCodigo("NORTE2")).thenReturn(Optional.empty());
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        TenantResponse response = tenantService.update(id, request);

        assertThat(response.getNombre()).isEqualTo("Norte Renovado");
        assertThat(response.getCodigo()).isEqualTo("NORTE2");
        assertThat(response.getActivo()).isFalse();
        verify(auditPublisher).publish(eq("UPDATE"), eq("Tenant"), anyMap());
    }

    @Test
    void update_lanza409SiElCodigoPerteneceAOtroTenant() {
        UUID id = UUID.randomUUID();
        Tenant existente = tenant(id, "Norte", "NORTE", true);
        Tenant otro = tenant(UUID.randomUUID(), "Sur", "SUR", true);
        TenantRequest request = new TenantRequest();
        request.setNombre("Norte");
        request.setCodigo("sur");

        when(tenantRepository.findById(id)).thenReturn(Optional.of(existente));
        when(tenantRepository.findByCodigo("SUR")).thenReturn(Optional.of(otro));

        assertThatThrownBy(() -> tenantService.update(id, request))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void delete_esSoftDeleteYPublicaAuditoria() {
        UUID id = UUID.randomUUID();
        Tenant existente = tenant(id, "Norte", "NORTE", true);
        when(tenantRepository.findById(id)).thenReturn(Optional.of(existente));
        when(tenantRepository.save(any(Tenant.class))).thenAnswer(inv -> inv.getArgument(0));

        tenantService.delete(id);

        assertThat(existente.getActivo()).isFalse();
        verify(tenantRepository).save(existente);
        verify(auditPublisher).publish(eq("DELETE"), eq("Tenant"), anyMap());
    }
}
