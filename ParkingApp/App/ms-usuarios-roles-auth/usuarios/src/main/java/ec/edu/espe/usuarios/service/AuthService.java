package ec.edu.espe.usuarios.service;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.dto.response.EmpresaDisponibleResponse;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.OAuthTokenResponse;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface AuthService {
    LoginResponse login(LoginRequest loginRequest);

    OAuthTokenResponse oauthToken(OAuthTokenRequest request);

    void logout(String token);

    Map<String, Object> introspectToken(String token);

    List<EmpresaDisponibleResponse> misEmpresas(String username);

    LoginResponse cambiarEmpresa(String username, UUID tenantId);
}
