package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.RoleCreateRequest;
import ec.edu.espe.usuarios.dto.response.RoleResponse;
import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleServiceImplTest {

    @Mock
    private RoleRepository roleRepository;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private RoleServiceImpl roleService;

    @Test
    void createRole_creaRolYPublicaAuditoria() {
        RoleCreateRequest request = new RoleCreateRequest();
        request.setName("SUPERVISOR");
        request.setDescription("Supervisa operadores");

        Role guardado = Role.builder().id(UUID.randomUUID()).name("SUPERVISOR").active(true).build();

        when(roleRepository.existsByName("SUPERVISOR")).thenReturn(false);
        when(roleRepository.save(any(Role.class))).thenReturn(guardado);

        RoleResponse response = roleService.createRole(request);

        assertThat(response.getName()).isEqualTo("SUPERVISOR");
        verify(auditPublisher).publish(eq("CREATE"), eq("Role"), anyMap());
    }

    @Test
    void createRole_lanzaExcepcionSiElNombreYaExiste() {
        RoleCreateRequest request = new RoleCreateRequest();
        request.setName("ADMIN");

        when(roleRepository.existsByName("ADMIN")).thenReturn(true);

        assertThatThrownBy(() -> roleService.createRole(request))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void getRoles_devuelveTodosLosRolesMapeados() {
        Role role = Role.builder().id(UUID.randomUUID()).name("CLIENT").active(true).build();
        when(roleRepository.findAll()).thenReturn(List.of(role));

        List<RoleResponse> result = roleService.getRoles();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("CLIENT");
    }
}
