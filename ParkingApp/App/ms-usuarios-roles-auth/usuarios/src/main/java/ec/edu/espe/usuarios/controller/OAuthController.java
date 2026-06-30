package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.dto.response.OAuthTokenResponse;
import ec.edu.espe.usuarios.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/oauth")
@RequiredArgsConstructor
public class OAuthController {

    private final AuthService authService;

    /**
     * Endpoint OAuth2-style (grant_type=password).
     * Publico: emite JWT para que otros microservicios lo validen.
     */
    @PostMapping("/token")
    public ResponseEntity<OAuthTokenResponse> token(@Valid @RequestBody OAuthTokenRequest request) {
        return ResponseEntity.ok(authService.oauthToken(request));
    }

    /**
     * Introspeccion de token para microservicios (validacion centralizada).
     */
    @PostMapping("/introspect")
    public ResponseEntity<Map<String, Object>> introspect(@RequestHeader("Authorization") String authHeader) {
        String token = extractToken(authHeader);
        return ResponseEntity.ok(authService.introspectToken(token));
    }

    private String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
