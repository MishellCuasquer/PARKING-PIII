package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.config.JwtConfig;
import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.OAuthTokenResponse;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.security.TokenBlacklistService;
import ec.edu.espe.usuarios.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private static final String PASSWORD_GRANT = "password";

    private final AuthenticationManager authenticationManager;
    private final JwtConfig jwtConfig;
    private final UserRepository userRepository;
    private final TokenBlacklistService tokenBlacklistService;
    private final AuditPublisher auditPublisher;

    @Override
    public LoginResponse login(LoginRequest loginRequest) {
        authenticate(loginRequest.getUsername(), loginRequest.getPassword());
        User user = loadUser(loginRequest.getUsername());
        List<String> roles = extractRoles(user);
        String token = jwtConfig.generateToken(user.getUsername(), user.getId().toString(), roles);

        auditPublisher.publish("LOGIN", "User", Map.of(
                "id", user.getId(),
                "username", user.getUsername()
        ));

        return LoginResponse.builder()
                .token(token)
                .expiresIn(jwtConfig.getExpirationTime())
                .userId(user.getId().toString())
                .username(user.getUsername())
                .roles(roles)
                .build();
    }

    @Override
    public OAuthTokenResponse oauthToken(OAuthTokenRequest request) {
        if (!PASSWORD_GRANT.equals(request.getGrantType())) {
            throw new BadCredentialsException("Unsupported grant_type: " + request.getGrantType());
        }
        authenticate(request.getUsername(), request.getPassword());
        User user = loadUser(request.getUsername());
        List<String> roles = extractRoles(user);
        String token = jwtConfig.generateToken(user.getUsername(), user.getId().toString(), roles);

        return OAuthTokenResponse.builder()
                .accessToken(token)
                .expiresIn(jwtConfig.getExpirationTime() / 1000)
                .userId(user.getId().toString())
                .username(user.getUsername())
                .roles(roles)
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
        result.put("iss", jwtConfig.getIssuer());
        return result;
    }

    private void authenticate(String username, String password) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(username, password)
        );
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
}
