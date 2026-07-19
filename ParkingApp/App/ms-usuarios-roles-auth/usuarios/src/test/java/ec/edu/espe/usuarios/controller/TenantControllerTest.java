package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.TenantRequest;
import ec.edu.espe.usuarios.dto.response.TenantResponse;
import ec.edu.espe.usuarios.services.TenantService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TenantControllerTest {

    @Mock
    private TenantService tenantService;

    @InjectMocks
    private TenantController controller;

    private final TenantResponse ejemplo = TenantResponse.builder()
            .id(UUID.randomUUID()).nombre("Norte").codigo("NORTE").activo(true).build();

    @Test
    void getPublicos_devuelveLosTenantsActivos() {
        when(tenantService.getPublicos()).thenReturn(List.of(ejemplo));

        var response = controller.getPublicos();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void getAll_devuelveTodos() {
        when(tenantService.getAll()).thenReturn(List.of(ejemplo));

        var response = controller.getAll();

        assertThat(response.getBody()).containsExactly(ejemplo);
    }

    @Test
    void getById_devuelveElTenant() {
        when(tenantService.getById(ejemplo.getId())).thenReturn(ejemplo);

        var response = controller.getById(ejemplo.getId());

        assertThat(response.getBody()).isEqualTo(ejemplo);
    }

    @Test
    void create_devuelve201() {
        TenantRequest request = new TenantRequest();
        when(tenantService.create(request)).thenReturn(ejemplo);

        var response = controller.create(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(ejemplo);
    }

    @Test
    void update_delegaEnElServicio() {
        TenantRequest request = new TenantRequest();
        when(tenantService.update(ejemplo.getId(), request)).thenReturn(ejemplo);

        var response = controller.update(ejemplo.getId(), request);

        assertThat(response.getBody()).isEqualTo(ejemplo);
    }

    @Test
    void delete_devuelve204() {
        var response = controller.delete(ejemplo.getId());

        verify(tenantService).delete(ejemplo.getId());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }
}
