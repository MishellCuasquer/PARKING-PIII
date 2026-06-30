package ec.edu.espe.usuarios.service;

import ec.edu.espe.usuarios.dto.request.LoginRequest;
import ec.edu.espe.usuarios.dto.request.OAuthTokenRequest;
import ec.edu.espe.usuarios.dto.response.LoginResponse;
import ec.edu.espe.usuarios.dto.response.OAuthTokenResponse;

import java.util.Map;

public interface AuthService {
    LoginResponse login(LoginRequest loginRequest);

    OAuthTokenResponse oauthToken(OAuthTokenRequest request);

    void logout(String token);

    Map<String, Object> introspectToken(String token);
}
