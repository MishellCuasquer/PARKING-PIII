package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.config.JwtConfig;
import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.security.TokenBlacklistService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

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
    private PersonRepository personRepository;
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

        when(userRepository.findByUsernameWithRole("jperez")).thenReturn(Optional.of(user));
        when(jwtConfig.generateToken(eq("jperez"), anyString(), any(), any())).thenReturn("token-123");
        when(jwtConfig.getExpirationTime()).thenReturn(3600000L);

        var response = authService.login(request);

        assertThat(response.getToken()).isEqualTo("token-123");
        assertThat(response.getUsername()).isEqualTo("jperez");
        assertThat(response.getRoles()).containsExactly("CLIENT");
        verify(auditPublisher).publish(eq("LOGIN"), eq("User"), anyMap(), eq("jperez"), any());
    }

    @Test
    void login_lanzaBadCredentialsSiElUsuarioNoExisteTrasAutenticar() {
        LoginRequest request = new LoginRequest();
        request.setUsername("fantasma");
        request.setPassword("secret");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void login_conCorreoPruebaCadaCuentaHastaQueLaContrasenaCoincide() {
        Role role = Role.builder().name("ADMIN").build();
        User cuentaNorte = User.builder().id(UUID.randomUUID()).username("dueno_norte").role(role).build();
        User cuentaSur = User.builder().id(UUID.randomUUID()).username("dueno_sur").role(role).build();
        LoginRequest request = new LoginRequest();
        request.setUsername("dueno@mail.com");
        request.setPassword("claveSur");

        when(userRepository.findAllByPersonEmailWithRole("dueno@mail.com"))
                .thenReturn(List.of(cuentaNorte, cuentaSur));
        when(authenticationManager.authenticate(any())).thenAnswer(inv -> {
            var auth = (UsernamePasswordAuthenticationToken) inv.getArgument(0);
            if ("dueno_norte".equals(auth.getName())) {
                throw new BadCredentialsException("bad");
            }
            return auth;
        });
        when(jwtConfig.generateToken(eq("dueno_sur"), anyString(), any(), any())).thenReturn("token-sur");
        when(jwtConfig.getExpirationTime()).thenReturn(3600000L);

        var response = authService.login(request);

        assertThat(response.getToken()).isEqualTo("token-sur");
        assertThat(response.getUsername()).isEqualTo("dueno_sur");
    }

    @Test
    void login_conCorreoLanzaBadCredentialsSiNingunaCuentaCoincide() {
        LoginRequest request = new LoginRequest();
        request.setUsername("nadie@mail.com");
        request.setPassword("clave");

        when(userRepository.findAllByPersonEmailWithRole("nadie@mail.com")).thenReturn(List.of());

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void oauthToken_generaTokenParaGrantTypePassword() {
        Role role = Role.builder().name("CLIENT").build();
        User user = User.builder().id(UUID.randomUUID()).username("jperez").role(role).build();
        OAuthTokenRequest request = new OAuthTokenRequest();
        request.setGrantType("password");
        request.setUsername("jperez");
        request.setPassword("secret");

        when(userRepository.findByUsernameWithRole("jperez")).thenReturn(Optional.of(user));
        when(jwtConfig.generateToken(eq("jperez"), anyString(), any(), any())).thenReturn("token-oauth");
        when(jwtConfig.getExpirationTime()).thenReturn(3600000L);

        var response = authService.oauthToken(request);

        assertThat(response.getAccessToken()).isEqualTo("token-oauth");
        assertThat(response.getUsername()).isEqualTo("jperez");
    }

    @Test
    void oauthToken_lanzaBadCredentialsSiElGrantTypeNoEsSoportado() {
        OAuthTokenRequest request = new OAuthTokenRequest();
        request.setGrantType("client_credentials");

        assertThatThrownBy(() -> authService.oauthToken(request))
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

    // ---- Mismo dueño con cuenta en varias empresas ----

    private Tenant tenantDe(String nombre, String codigo, boolean activo) {
        return Tenant.builder().id(UUID.randomUUID()).nombre(nombre).codigo(codigo).activo(activo).build();
    }

    private Person personaDe(String email, String dni, Tenant tenant) {
        return Person.builder().id(UUID.randomUUID()).email(email).dni(dni).tenant(tenant).build();
    }

    private User cuentaDe(String username, Person person) {
        Role role = Role.builder().name("ADMIN").build();
        return User.builder().id(person.getId()).username(username).role(role).person(person).build();
    }

    @Test
    void misEmpresas_devuelveLasEmpresasConMismoEmailYDniFiltrandoInactivas() {
        Tenant norte = tenantDe("Norte", "NORTE", true);
        Tenant sur = tenantDe("Sur", "SUR", true);
        Tenant cerrado = tenantDe("Cerrado", "CER", false);

        Person pNorte = personaDe("nora@mail.com", "170001", norte);
        Person pSur = personaDe("nora@mail.com", "170001", sur);
        Person otraCedula = personaDe("nora@mail.com", "999999", sur);
        Person pCerrado = personaDe("nora@mail.com", "170001", cerrado);

        User caller = cuentaDe("nora_norte", pNorte);
        User cuentaSur = cuentaDe("nora_sur", pSur);

        when(userRepository.findByUsernameWithRole("nora_norte")).thenReturn(Optional.of(caller));
        when(personRepository.findAllByEmail("nora@mail.com"))
                .thenReturn(List.of(pNorte, pSur, otraCedula, pCerrado));
        when(userRepository.findById(pNorte.getId())).thenReturn(Optional.of(caller));
        when(userRepository.findById(pSur.getId())).thenReturn(Optional.of(cuentaSur));

        var empresas = authService.misEmpresas("nora_norte");

        assertThat(empresas).hasSize(2);
        assertThat(empresas).filteredOn("actual", true)
                .singleElement()
                .extracting("tenantNombre").isEqualTo("Norte");
        assertThat(empresas).extracting("tenantCodigo").containsExactlyInAnyOrder("NORTE", "SUR");
    }

    @Test
    void misEmpresas_devuelveVacioParaCuentasGlobalesSinPerson() {
        User superadmin = User.builder().id(UUID.randomUUID()).username("superadmin").build();
        when(userRepository.findByUsernameWithRole("superadmin")).thenReturn(Optional.of(superadmin));

        assertThat(authService.misEmpresas("superadmin")).isEmpty();
    }

    @Test
    void cambiarEmpresa_emiteTokenParaLaCuentaDeLaOtraEmpresa() {
        Tenant norte = tenantDe("Norte", "NORTE", true);
        Tenant sur = tenantDe("Sur", "SUR", true);
        Person pNorte = personaDe("nora@mail.com", "170001", norte);
        Person pSur = personaDe("nora@mail.com", "170001", sur);
        User caller = cuentaDe("nora_norte", pNorte);
        User cuentaSur = cuentaDe("nora_sur", pSur);

        when(userRepository.findByUsernameWithRole("nora_norte")).thenReturn(Optional.of(caller));
        when(personRepository.findAllByEmail("nora@mail.com")).thenReturn(List.of(pNorte, pSur));
        when(userRepository.findById(pNorte.getId())).thenReturn(Optional.of(caller));
        when(userRepository.findById(pSur.getId())).thenReturn(Optional.of(cuentaSur));
        when(userRepository.findByUsernameWithRole("nora_sur")).thenReturn(Optional.of(cuentaSur));
        when(jwtConfig.generateToken(eq("nora_sur"), anyString(), any(), eq(sur.getId().toString())))
                .thenReturn("token-sur");
        when(jwtConfig.getExpirationTime()).thenReturn(3600000L);

        var response = authService.cambiarEmpresa("nora_norte", sur.getId());

        assertThat(response.getToken()).isEqualTo("token-sur");
        assertThat(response.getTenantId()).isEqualTo(sur.getId().toString());
        assertThat(response.getTenantNombre()).isEqualTo("Sur");
        verify(auditPublisher).publish(eq("LOGIN"), eq("User"), anyMap(), eq("nora_sur"), eq(sur.getId().toString()));
    }

    @Test
    void cambiarEmpresa_lanza404SiNoTieneCuentaEnEsaEmpresa() {
        Tenant norte = tenantDe("Norte", "NORTE", true);
        Person pNorte = personaDe("nora@mail.com", "170001", norte);
        User caller = cuentaDe("nora_norte", pNorte);

        when(userRepository.findByUsernameWithRole("nora_norte")).thenReturn(Optional.of(caller));
        when(personRepository.findAllByEmail("nora@mail.com")).thenReturn(List.of(pNorte));
        when(userRepository.findById(pNorte.getId())).thenReturn(Optional.of(caller));

        UUID tenantAjeno = UUID.randomUUID();
        assertThatThrownBy(() -> authService.cambiarEmpresa("nora_norte", tenantAjeno))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
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
