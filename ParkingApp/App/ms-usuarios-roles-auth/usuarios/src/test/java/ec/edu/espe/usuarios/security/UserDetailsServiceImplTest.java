package ec.edu.espe.usuarios.security;

import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserDetailsServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserDetailsServiceImpl userDetailsService;

    @Test
    void loadUserByUsername_devuelveUserDetailsConRolPrefijado() {
        Role role = Role.builder().name("ADMIN").build();
        User user = User.builder()
                .username("jperez")
                .passwordHash("hash")
                .active(true)
                .role(role)
                .build();
        when(userRepository.findByUsernameWithRole("jperez")).thenReturn(Optional.of(user));

        UserDetails result = userDetailsService.loadUserByUsername("jperez");

        assertThat(result.getUsername()).isEqualTo("jperez");
        assertThat(result.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
    }

    @Test
    void loadUserByUsername_lanzaExcepcionSiNoExiste() {
        when(userRepository.findByUsernameWithRole("fantasma")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("fantasma"))
                .isInstanceOf(UsernameNotFoundException.class);
    }

    @Test
    void loadUserByUsername_lanzaExcepcionSiElUsuarioEstaInactivo() {
        User user = User.builder().username("inactivo").passwordHash("hash").active(false).build();
        when(userRepository.findByUsernameWithRole("inactivo")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> userDetailsService.loadUserByUsername("inactivo"))
                .isInstanceOf(UsernameNotFoundException.class);
    }
}
