package ec.edu.espe.usuarios.service.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.RecuperarPasswordRequest;
import ec.edu.espe.usuarios.dto.request.RestablecerPasswordRequest;
import ec.edu.espe.usuarios.dto.response.RecuperarPasswordResponse;
import ec.edu.espe.usuarios.entity.PasswordResetToken;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Tenant;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.PasswordResetTokenRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.service.PasswordResetService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Recuperacion de contrasena por correo.
 *
 * <p>El token viaja al usuario, pero en base de datos solo queda su hash
 * SHA-256. Es la misma idea que con las contrasenas: la tabla no debe permitir
 * suplantar a nadie aunque se filtre.</p>
 *
 * <p>Este microservicio no tiene servidor de correo configurado. El token se
 * escribe en el log (nivel INFO) y, si <code>app.password-reset.exponer-token
 * </code> esta activo, tambien en la respuesta HTTP. Esa propiedad esta
 * pensada SOLO para desarrollo y para la demo; en produccion se deja en false
 * y el envio real se engancha en {@link #entregarToken}.</p>
 */
@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    // Mismo texto exista o no el correo: el endpoint no puede servir para
    // averiguar que correos estan registrados.
    private static final String MENSAJE_GENERICO =
            "Si el correo está registrado, se ha enviado un enlace para restablecer la contraseña.";

    private static final int BYTES_TOKEN = 32;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditPublisher auditPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.password-reset.ttl-minutos:30}")
    private long ttlMinutos;

    @Value("${app.password-reset.exponer-token:false}")
    private boolean exponerToken;

    @Override
    public RecuperarPasswordResponse solicitar(RecuperarPasswordRequest request) {
        String email = request.getEmail().trim();

        // Una persona puede tener cuenta en varias empresas con el mismo correo:
        // se emite un token por cuenta y cada uno restablece solo la suya.
        List<User> cuentas = userRepository.findAllByPersonEmailWithRole(email);

        List<RecuperarPasswordResponse.TokenEmitido> emitidos = new ArrayList<>();
        for (User cuenta : cuentas) {
            if (Boolean.FALSE.equals(cuenta.getActive())) {
                continue;
            }
            emitidos.add(emitirToken(cuenta));
        }

        if (cuentas.isEmpty()) {
            log.info("Solicitud de recuperación para un correo sin cuentas activas");
        }

        return RecuperarPasswordResponse.builder()
                .mensaje(MENSAJE_GENERICO)
                .tokens(exponerToken && !emitidos.isEmpty() ? emitidos : null)
                .build();
    }

    @Override
    public void restablecer(RestablecerPasswordRequest request) {
        PasswordResetToken token = tokenRepository.findByTokenHash(hash(request.getToken()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "El enlace de recuperación no es válido o ya fue utilizado"));

        if (!token.estaVigente()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "El enlace de recuperación no es válido o ya fue utilizado");
        }

        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNuevaPassword()));
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // Un solo uso: el token se marca antes de devolver el control.
        token.setUsado(true);
        tokenRepository.save(token);

        auditPublisher.publish("PASSWORD_RESET", "User", Map.of(
                "id", user.getId(),
                "username", user.getUsername()
        ), user.getUsername(), tenantIdDe(user));

        log.info("Contraseña restablecida para el usuario {}", user.getUsername());
    }

    private RecuperarPasswordResponse.TokenEmitido emitirToken(User cuenta) {
        // Pedir el enlace dos veces no debe dejar dos enlaces validos.
        tokenRepository.invalidarPendientesDe(cuenta);

        byte[] aleatorio = new byte[BYTES_TOKEN];
        secureRandom.nextBytes(aleatorio);
        String tokenPlano = Base64.getUrlEncoder().withoutPadding().encodeToString(aleatorio);

        tokenRepository.save(PasswordResetToken.builder()
                .tokenHash(hash(tokenPlano))
                .user(cuenta)
                .expiresAt(LocalDateTime.now().plusMinutes(ttlMinutos))
                .usado(false)
                .build());

        entregarToken(cuenta, tokenPlano);

        return RecuperarPasswordResponse.TokenEmitido.builder()
                .username(cuenta.getUsername())
                .empresa(nombreEmpresaDe(cuenta))
                .token(tokenPlano)
                .build();
    }

    /**
     * Punto de enganche del envio real. Hoy escribe el token en el log porque
     * el despliegue no tiene servidor SMTP; sustituir por un JavaMailSender no
     * obliga a tocar nada mas de esta clase.
     */
    private void entregarToken(User cuenta, String tokenPlano) {
        log.info("Token de recuperación para {} (válido {} min): {}",
                cuenta.getUsername(), ttlMinutos, tokenPlano);
    }

    private String hash(String valor) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] resumen = digest.digest(valor.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(resumen.length * 2);
            for (byte b : resumen) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 es obligatorio en toda JVM; si falta, el entorno esta roto.
            throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
        }
    }

    private String nombreEmpresaDe(User cuenta) {
        Tenant tenant = tenantDe(cuenta);
        return tenant != null ? tenant.getNombre() : null;
    }

    private String tenantIdDe(User cuenta) {
        Tenant tenant = tenantDe(cuenta);
        return tenant != null ? tenant.getId().toString() : null;
    }

    private Tenant tenantDe(User cuenta) {
        Person person = cuenta.getPerson();
        return person != null ? person.getTenant() : null;
    }
}
