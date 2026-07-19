package ec.edu.espe.usuarios.security;

import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CallerContextTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private CallerContext callerContext;

    @AfterEach
    void limpiarContexto() {
        SecurityContextHolder.clearContext();
    }

    private void autenticar(String username) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(username, "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
    }

    @Test
    void devuelveNullSinAutenticacion() {
        SecurityContextHolder.clearContext();

        assertThat(callerContext.callerTenantId()).isNull();
    }

    @Test
    void devuelveNullParaPeticionesAnonimas() {
        SecurityContextHolder.getContext().setAuthentication(
                new AnonymousAuthenticationToken("key", "anonymousUser",
                        List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))));

        assertThat(callerContext.callerTenantId()).isNull();
    }

    @Test
    void devuelveElTenantDelUsuarioAutenticado() {
        UUID tenantId = UUID.randomUUID();
        Tenant tenant = Tenant.builder().id(tenantId).nombre("Norte").codigo("NORTE").build();
        Person person = Person.builder().id(UUID.randomUUID()).tenant(tenant).build();
        User user = User.builder().id(person.getId()).username("nora").person(person).build();
        autenticar("nora");
        when(userRepository.findByUsernameWithRole("nora")).thenReturn(Optional.of(user));

        assertThat(callerContext.callerTenantId()).isEqualTo(tenantId);
    }

    @Test
    void devuelveNullParaCuentasGlobalesSinPerson() {
        User superadmin = User.builder().id(UUID.randomUUID()).username("superadmin").build();
        autenticar("superadmin");
        when(userRepository.findByUsernameWithRole("superadmin")).thenReturn(Optional.of(superadmin));

        assertThat(callerContext.callerTenantId()).isNull();
    }
}
