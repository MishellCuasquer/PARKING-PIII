package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.config.JwtConfig;
import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.security.TokenBlacklistService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtConfig jwtConfig;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TokenBlacklistService tokenBlacklistService;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private AuthServiceImpl authService;

    @Test
    void login_generaTokenYPublicaEventoLogin() {
        Role role = Role.builder().name("CLIENT").build();
        User user = User.builder().id(UUID.randomUUID()).username("jperez").role(role).build();
        LoginRequest request = new LoginRequest();
        request.setUsername("jperez");
        request.setPassword("secret");

        when(userRepository.findByUsername("jperez")).thenReturn(Optional.of(user));
        when(jwtConfig.generateToken(eq("jperez"), anyString(), any())).thenReturn("token-123");
        when(jwtConfig.getExpirationTime()).thenReturn(3600000L);

        var response = authService.login(request);

        assertThat(response.getToken()).isEqualTo("token-123");
        assertThat(response.getUsername()).isEqualTo("jperez");
        assertThat(response.getRoles()).containsExactly("CLIENT");
        verify(auditPublisher).publish(eq("LOGIN"), eq("User"), anyMap());
    }

    @Test
    void login_lanzaBadCredentialsSiElUsuarioNoExisteTrasAutenticar() {
        LoginRequest request = new LoginRequest();
        request.setUsername("fantasma");
        request.setPassword("secret");

        when(userRepository.findByUsername("fantasma")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void logout_agregaElTokenALaListaNegraSiEsValido() {
        when(jwtConfig.validateToken("token-valido")).thenReturn(true);
        when(jwtConfig.getExpirationEpochMs("token-valido")).thenReturn(123456789L);

        authService.logout("token-valido");

        verify(tokenBlacklistService).blacklist("token-valido", 123456789L);
    }

    @Test
    void logout_lanzaBadCredentialsSiElTokenEsInvalido() {
        when(jwtConfig.validateToken("token-invalido")).thenReturn(false);

        assertThatThrownBy(() -> authService.logout("token-invalido"))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void introspectToken_devuelveActivoFalseSiElTokenEstaEnListaNegra() {
        when(jwtConfig.validateToken("token")).thenReturn(true);
        when(tokenBlacklistService.isBlacklisted("token")).thenReturn(true);

        Map<String, Object> result = authService.introspectToken("token");

        assertThat(result.get("active")).isEqualTo(false);
    }

    @Test
    void introspectToken_devuelveDatosDelTokenCuandoEsValido() {
        when(jwtConfig.validateToken("token")).thenReturn(true);
        when(tokenBlacklistService.isBlacklisted("token")).thenReturn(false);
        when(jwtConfig.getUsernameFromToken("token")).thenReturn("jperez");
        when(jwtConfig.getUserIdFromToken("token")).thenReturn("user-1");
        when(jwtConfig.getRolesFromToken("token")).thenReturn(List.of("CLIENT"));
        when(jwtConfig.getIssuer()).thenReturn("parking-app");

        Map<String, Object> result = authService.introspectToken("token");

        assertThat(result.get("active")).isEqualTo(true);
        assertThat(result.get("username")).isEqualTo("jperez");
    }
}
