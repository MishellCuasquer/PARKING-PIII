package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.config.JwtConfig;
import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.dto.response.EmpresaDisponibleResponse;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.OAuthTokenResponse;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.security.TokenBlacklistService;
import ec.edu.espe.usuarios.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String PASSWORD_GRANT = "password";

    private final AuthenticationManager authenticationManager;
    private final JwtConfig jwtConfig;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuditPublisher auditPublisher;

    @Override
    public LoginResponse login(LoginRequest loginRequest) {
        User user = authenticateAndLoad(loginRequest.getUsername(), loginRequest.getPassword());
        List<String> roles = extractRoles(user);
        Tenant tenant = extractTenant(user);
        String tenantId = tenant != null ? tenant.getId().toString() : null;
        String token = jwtConfig.generateToken(user.getUsername(), user.getId().toString(), roles, tenantId);

        auditPublisher.publish("LOGIN", "User", Map.of(
                "id", user.getId(),
                "username", user.getUsername()
        ), user.getUsername(), tenantId);

        return LoginResponse.builder()
                .token(token)
                .expiresIn(jwtConfig.getExpirationTime())
                .userId(user.getId().toString())
                .username(user.getUsername())
                .roles(roles)
                .tenantId(tenantId)
                .tenantNombre(tenant != null ? tenant.getNombre() : null)
                .build();
    }

    @Override
    public OAuthTokenResponse oauthToken(OAuthTokenRequest request) {
        if (!PASSWORD_GRANT.equals(request.getGrantType())) {
            throw new BadCredentialsException("Unsupported grant_type: " + request.getGrantType());
        }
        User user = authenticateAndLoad(request.getUsername(), request.getPassword());
        List<String> roles = extractRoles(user);
        Tenant tenant = extractTenant(user);
        String tenantId = tenant != null ? tenant.getId().toString() : null;
        String token = jwtConfig.generateToken(user.getUsername(), user.getId().toString(), roles, tenantId);

        return OAuthTokenResponse.builder()
                .accessToken(token)
                .expiresIn(jwtConfig.getExpirationTime() / 1000)
                .userId(user.getId().toString())
                .username(user.getUsername())
                .roles(roles)
                .tenantId(tenantId)
                .build();
    }

    @Override
    public void logout(String token) {
        if (token == null || !jwtConfig.validateToken(token)) {
            throw new BadCredentialsException("Invalid token");
        }
        tokenBlacklistService.blacklist(token, jwtConfig.getExpirationEpochMs(token));
    }

    @Override
    public Map<String, Object> introspectToken(String token) {
        if (token == null || !jwtConfig.validateToken(token) || tokenBlacklistService.isBlacklisted(token)) {
            return Map.of("active", false);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("active", true);
        result.put("username", jwtConfig.getUsernameFromToken(token));
        result.put("userId", jwtConfig.getUserIdFromToken(token));
        result.put("roles", jwtConfig.getRolesFromToken(token));
        String tenantId = jwtConfig.getTenantIdFromToken(token);
        if (tenantId != null) {
            result.put("tenantId", tenantId);
        }
        result.put("iss", jwtConfig.getIssuer());
        return result;
    }

    /**
     * Empresas donde la persona autenticada tiene cuenta: se identifican por
     * email + dni iguales (la misma persona registrada en varios parqueaderos).
     */
    @Override
    @Transactional(readOnly = true)
    public List<EmpresaDisponibleResponse> misEmpresas(String username) {
        User caller = loadUser(username);
        Person callerPerson = caller.getPerson();
        if (callerPerson == null) {
            return Collections.emptyList();
        }

        return personRepository.findAllByEmail(callerPerson.getEmail()).stream()
                .filter(p -> Objects.equals(p.getDni(), callerPerson.getDni()))
                .filter(p -> p.getTenant() != null && Boolean.TRUE.equals(p.getTenant().getActivo()))
                .map(p -> {
                    User cuenta = userRepository.findById(p.getId()).orElse(null);
                    if (cuenta == null || !Boolean.TRUE.equals(cuenta.getActive())) {
                        return null;
                    }
                    return EmpresaDisponibleResponse.builder()
                            .tenantId(p.getTenant().getId())
                            .tenantNombre(p.getTenant().getNombre())
                            .tenantCodigo(p.getTenant().getCodigo())
                            .username(cuenta.getUsername())
                            .roles(extractRoles(cuenta))
                            .actual(cuenta.getId().equals(caller.getId()))
                            .build();
                })
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * Cambia el contexto a otra empresa del mismo dueño: emite un token para la
     * cuenta de esa empresa. Si no hay cuenta con el mismo email+dni ahí → 404
     * (sin revelar información de otras empresas).
     */
    @Override
    @Transactional
    public LoginResponse cambiarEmpresa(String username, UUID tenantId) {
        User destino = misEmpresas(username).stream()
                .filter(e -> e.getTenantId().equals(tenantId))
                .findFirst()
                .flatMap(e -> userRepository.findByUsernameWithRole(e.getUsername()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "No tienes cuenta en esa empresa"));

        List<String> roles = extractRoles(destino);
        Tenant tenant = extractTenant(destino);
        String destinoTenantId = tenant != null ? tenant.getId().toString() : null;
        String token = jwtConfig.generateToken(destino.getUsername(), destino.getId().toString(), roles, destinoTenantId);

        auditPublisher.publish("LOGIN", "User", Map.of(
                "id", destino.getId(),
                "username", destino.getUsername(),
                "cambioEmpresa", true
        ), destino.getUsername(), destinoTenantId);

        return LoginResponse.builder()
                .token(token)
                .expiresIn(jwtConfig.getExpirationTime())
                .userId(destino.getId().toString())
                .username(destino.getUsername())
                .roles(roles)
                .tenantId(destinoTenantId)
                .tenantNombre(tenant != null ? tenant.getNombre() : null)
                .build();
    }

    private void authenticate(String username, String password) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password)
        );
    }

    /**
     * Acepta username o correo. Con correo puede haber una cuenta por empresa
     * (mismo dueño en varios parqueaderos): se prueba cada cuenta hasta que la
     * contraseña coincida, sin revelar en cuáles empresas existe el correo.
     */
    private User authenticateAndLoad(String identifier, String password) {
        if (identifier == null || !identifier.contains("@")) {
            authenticate(identifier, password);
            return loadUser(identifier);
        }
        for (User cuenta : userRepository.findAllByPersonEmailWithRole(identifier)) {
            try {
                authenticate(cuenta.getUsername(), password);
                return cuenta;
            } catch (AuthenticationException e) {
                // la contraseña no corresponde a esta cuenta; probar la siguiente empresa
            }
        }
        throw new BadCredentialsException("Bad credentials");
    }

    private User loadUser(String username) {
        return userRepository.findByUsernameWithRole(username)
                .orElseThrow(() -> new BadCredentialsException("User not found"));
    }

    private List<String> extractRoles(User user) {
        return user.getRole() != null
                ? Collections.singletonList(user.getRole().getName())
                : Collections.emptyList();
    }

    // Null para cuentas sin tenant (superadmin, service); person/tenant vienen fetch-joineados en loadUser
    private Tenant extractTenant(User user) {
        return user.getPerson() != null ? user.getPerson().getTenant() : null;
    }
}
