package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class TokenValidationController {

    private final AuthService authService;

    @PostMapping("/validate-token")
    public ResponseEntity<Map<String, Object>> validateToken(@RequestHeader("Authorization") String authHeader) {
        String token = extractToken(authHeader);
        Map<String, Object> result = authService.introspectToken(token);

        if (Boolean.FALSE.equals(result.get("active"))) {
            return ResponseEntity.ok(Map.of(
                    "valid", false,
                    "message", "Invalid, expired or revoked token"
            ));
        }

        return ResponseEntity.ok(Map.of(
                "valid", true,
                "username", result.get("username"),
                "userId", result.get("userId"),
                "roles", result.get("roles")
        ));
    }

    private String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
