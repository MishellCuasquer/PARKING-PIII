package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.RecuperarPasswordRequest;
import ec.edu.espe.usuarios.dto.request.RestablecerPasswordRequest;
import ec.edu.espe.usuarios.dto.response.RecuperarPasswordResponse;
import ec.edu.espe.usuarios.entity.PasswordResetToken;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.PasswordResetTokenRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordResetTokenRepository tokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuditPublisher auditPublisher;

    private PasswordResetServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PasswordResetServiceImpl(
                userRepository, tokenRepository, passwordEncoder, auditPublisher);
        ReflectionTestUtils.setField(service, "ttlMinutos", 30L);
        ReflectionTestUtils.setField(service, "exponerToken", true);
    }

    private User cuenta(String username, boolean activa) {
        Tenant tenant = Tenant.builder().id(UUID.randomUUID()).nombre("Parqueadero Norte").build();
        Person person = new Person();
        person.setTenant(tenant);
        return User.builder()
                .id(UUID.randomUUID())
                .username(username)
                .person(person)
                .active(activa)
                .passwordHash("hash-viejo")
                .build();
    }

    @Test
    void solicitar_emiteUnTokenPorCadaCuentaDelCorreo() {
        // La misma persona con cuenta en dos empresas: un token por empresa,
        // porque cada uno restablece una cuenta distinta.
        when(userRepository.findAllByPersonEmailWithRole("ana@espe.edu.ec"))
                .thenReturn(List.of(cuenta("ana.norte", true), cuenta("ana.sur", true)));

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");

        RecuperarPasswordResponse response = service.solicitar(request);

        assertThat(response.getTokens()).hasSize(2);
        assertThat(response.getTokens()).extracting("username")
                .containsExactlyInAnyOrder("ana.norte", "ana.sur");
        verify(tokenRepository, org.mockito.Mockito.times(2)).save(any(PasswordResetToken.class));
    }

    @Test
    void solicitar_invalidaLosTokensAnterioresDeLaCuenta() {
        User user = cuenta("ana.norte", true);
        when(userRepository.findAllByPersonEmailWithRole(anyString())).thenReturn(List.of(user));

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");
        service.solicitar(request);

        verify(tokenRepository).invalidarPendientesDe(user);
    }

    @Test
    void solicitar_guardaElHashDelTokenYNuncaElTokenEnClaro() {
        when(userRepository.findAllByPersonEmailWithRole(anyString()))
                .thenReturn(List.of(cuenta("ana.norte", true)));

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");
        RecuperarPasswordResponse response = service.solicitar(request);

        ArgumentCaptor<PasswordResetToken> captor = ArgumentCaptor.forClass(PasswordResetToken.class);
        verify(tokenRepository).save(captor.capture());

        String tokenEnClaro = response.getTokens().get(0).getToken();
        assertThat(captor.getValue().getTokenHash())
                .isNotEqualTo(tokenEnClaro)
                .hasSize(64);
    }

    @Test
    void solicitar_ignoraLasCuentasDesactivadas() {
        when(userRepository.findAllByPersonEmailWithRole(anyString()))
                .thenReturn(List.of(cuenta("ana.baja", false)));

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");
        RecuperarPasswordResponse response = service.solicitar(request);

        assertThat(response.getTokens()).isNull();
        verify(tokenRepository, never()).save(any(PasswordResetToken.class));
    }

    /** No debe delatar qué correos existen: mismo 200 y mismo mensaje. */
    @Test
    void solicitar_conCorreoInexistenteDevuelveElMismoMensajeSinTokens() {
        when(userRepository.findAllByPersonEmailWithRole(anyString())).thenReturn(List.of());

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("nadie@espe.edu.ec");
        RecuperarPasswordResponse response = service.solicitar(request);

        assertThat(response.getMensaje()).contains("Si el correo está registrado");
        assertThat(response.getTokens()).isNull();
    }

    @Test
    void solicitar_noExponeElTokenCuandoLaPropiedadEstaDesactivada() {
        ReflectionTestUtils.setField(service, "exponerToken", false);
        when(userRepository.findAllByPersonEmailWithRole(anyString()))
                .thenReturn(List.of(cuenta("ana.norte", true)));

        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");

        assertThat(service.solicitar(request).getTokens()).isNull();
        // El token se emite igual, solo que no viaja en la respuesta.
        verify(tokenRepository).save(any(PasswordResetToken.class));
    }

    @Test
    void restablecer_cambiaLaPasswordYConsumeElToken() {
        User user = cuenta("ana.norte", true);
        PasswordResetToken token = PasswordResetToken.builder()
                .user(user)
                .usado(false)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));
        when(passwordEncoder.encode("nuevaClave123")).thenReturn("hash-nuevo");

        RestablecerPasswordRequest request = new RestablecerPasswordRequest();
        request.setToken("token-cualquiera");
        request.setNuevaPassword("nuevaClave123");

        service.restablecer(request);

        assertThat(user.getPasswordHash()).isEqualTo("hash-nuevo");
        assertThat(token.getUsado()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    void restablecer_rechazaUnTokenYaUtilizado() {
        PasswordResetToken token = PasswordResetToken.builder()
                .user(cuenta("ana.norte", true))
                .usado(true)
                .expiresAt(LocalDateTime.now().plusMinutes(10))
                .build();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        RestablecerPasswordRequest request = new RestablecerPasswordRequest();
        request.setToken("token-usado");
        request.setNuevaPassword("nuevaClave123");

        assertThatThrownBy(() -> service.restablecer(request))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void restablecer_rechazaUnTokenCaducado() {
        PasswordResetToken token = PasswordResetToken.builder()
                .user(cuenta("ana.norte", true))
                .usado(false)
                .expiresAt(LocalDateTime.now().minusMinutes(1))
                .build();
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(token));

        RestablecerPasswordRequest request = new RestablecerPasswordRequest();
        request.setToken("token-viejo");
        request.setNuevaPassword("nuevaClave123");

        assertThatThrownBy(() -> service.restablecer(request))
                .isInstanceOf(ResponseStatusException.class);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void restablecer_rechazaUnTokenInexistente() {
        when(tokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

        RestablecerPasswordRequest request = new RestablecerPasswordRequest();
        request.setToken("no-existe");
        request.setNuevaPassword("nuevaClave123");

        assertThatThrownBy(() -> service.restablecer(request))
                .isInstanceOf(ResponseStatusException.class);
    }
}
