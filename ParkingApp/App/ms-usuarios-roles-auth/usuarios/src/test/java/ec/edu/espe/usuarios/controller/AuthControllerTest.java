package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.RecuperarPasswordRequest;
import ec.edu.espe.usuarios.dto.request.RestablecerPasswordRequest;
import ec.edu.espe.usuarios.dto.response.EmpresaDisponibleResponse;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.RecuperarPasswordResponse;
import ec.edu.espe.usuarios.service.AuthService;
import ec.edu.espe.usuarios.service.PasswordResetService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private AuthService authService;
    @Mock
    private PasswordResetService passwordResetService;
    @Mock
    private Authentication authentication;

    @InjectMocks
    private AuthController controller;

    @Test
    void recuperarPassword_delegaEnElServicioYDevuelveElMensajeGenerico() {
        RecuperarPasswordRequest request = new RecuperarPasswordRequest();
        request.setEmail("ana@espe.edu.ec");
        RecuperarPasswordResponse esperado = RecuperarPasswordResponse.builder()
                .mensaje("Si el correo está registrado, se ha enviado un enlace para restablecer la contraseña.")
                .build();
        when(passwordResetService.solicitar(request)).thenReturn(esperado);

        var response = controller.recuperarPassword(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo(esperado);
    }

    @Test
    void restablecerPassword_consumeElTokenYConfirma() {
        RestablecerPasswordRequest request = new RestablecerPasswordRequest();
        request.setToken("token-valido");
        request.setNuevaPassword("claveNueva123");

        var response = controller.restablecerPassword(request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("message", "Contraseña actualizada correctamente");
        verify(passwordResetService).restablecer(request);
    }

    @Test
    void login_delegaEnElServicio() {
        LoginRequest request = new LoginRequest();
        LoginResponse esperado = LoginResponse.builder().token("t").build();
        when(authService.login(request)).thenReturn(esperado);

        var response = controller.login(request);

        assertThat(response.getBody()).isEqualTo(esperado);
    }

    @Test
    void logout_extraeElTokenDelHeaderBearer() {
        var response = controller.logout("Bearer token-123");

        verify(authService).logout("token-123");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void logout_pasaNullSiElHeaderNoEsBearer() {
        controller.logout("Basic abc");

        verify(authService).logout(null);
    }

    @Test
    void misEmpresas_devuelveLasEmpresasDelUsuario() {
        when(authentication.getName()).thenReturn("nora");
        List<EmpresaDisponibleResponse> empresas = List.of(
                EmpresaDisponibleResponse.builder().tenantId(UUID.randomUUID()).build());
        when(authService.misEmpresas("nora")).thenReturn(empresas);

        var response = controller.misEmpresas(authentication);

        assertThat(response.getBody()).isEqualTo(empresas);
    }

    @Test
    void cambiarEmpresa_delegaConElUuid() {
        UUID tenantId = UUID.randomUUID();
        when(authentication.getName()).thenReturn("nora");
        LoginResponse esperado = LoginResponse.builder().token("nuevo").build();
        when(authService.cambiarEmpresa("nora", tenantId)).thenReturn(esperado);

        var response = controller.cambiarEmpresa(authentication, Map.of("tenantId", tenantId.toString()));

        assertThat(response.getBody()).isEqualTo(esperado);
    }

    @Test
    void cambiarEmpresa_lanza400SinTenantId() {
        assertThatThrownBy(() -> controller.cambiarEmpresa(authentication, Map.of()))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void cambiarEmpresa_lanza400ConTenantIdInvalido() {
        assertThatThrownBy(() -> controller.cambiarEmpresa(authentication, Map.of("tenantId", "no-es-uuid")))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(e -> ((ResponseStatusException) e).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
