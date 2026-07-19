package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.response.EmpresaDisponibleResponse;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest) {
        return ResponseEntity.ok(authService.login(loginRequest));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(@RequestHeader("Authorization") String authHeader) {
        String token = extractToken(authHeader);
        authService.logout(token);
        return ResponseEntity.ok(Map.of("message", "Logout successful"));
    }

    // Empresas donde la persona autenticada (mismo email+dni) tiene cuenta
    @GetMapping("/empresas")
    public ResponseEntity<List<EmpresaDisponibleResponse>> misEmpresas(Authentication authentication) {
        return ResponseEntity.ok(authService.misEmpresas(authentication.getName()));
    }

    // Cambia el contexto a otra empresa del mismo dueño: devuelve un token nuevo
    @PostMapping("/cambiar-empresa")
    public ResponseEntity<LoginResponse> cambiarEmpresa(Authentication authentication,
                                                        @RequestBody Map<String, String> body) {
        String tenantId = body.get("tenantId");
        if (tenantId == null || tenantId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tenantId es obligatorio");
        }
        UUID tenantUuid;
        try {
            tenantUuid = UUID.fromString(tenantId);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tenantId inválido");
        }
        return ResponseEntity.ok(authService.cambiarEmpresa(authentication.getName(), tenantUuid));
    }

    private String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
