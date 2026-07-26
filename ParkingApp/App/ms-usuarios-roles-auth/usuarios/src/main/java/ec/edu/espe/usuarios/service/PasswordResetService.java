package ec.edu.espe.usuarios.service;

import ec.edu.espe.usuarios.dto.request.RecuperarPasswordRequest;
import ec.edu.espe.usuarios.dto.request.RestablecerPasswordRequest;
import ec.edu.espe.usuarios.dto.response.RecuperarPasswordResponse;

public interface PasswordResetService {

    /** Emite un token de restablecimiento por cada cuenta que use ese correo. */
    RecuperarPasswordResponse solicitar(RecuperarPasswordRequest request);

    /** Consume el token y fija la nueva contrasena. */
    void restablecer(RestablecerPasswordRequest request);
}
