package ec.edu.espe.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Token de un solo uso para restablecer la contrasena.
 *
 * <p>La columna guarda el HASH SHA-256 del token, nunca el token en claro: si
 * alguien consigue leer la tabla no puede secuestrar los restablecimientos en
 * curso, igual que pasa con las contrasenas.</p>
 */
@Entity
@Table(
        name = "password_reset_tokens",
        indexes = @Index(name = "idx_prt_token_hash", columnList = "token_hash")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PasswordResetToken {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "token_hash", nullable = false, unique = true, length = 64)
    private String tokenHash;

    /**
     * Cuenta concreta a restablecer. Es una referencia al usuario y no al
     * correo porque una misma persona puede tener cuenta en varias empresas:
     * el token tiene que dejar claro CUAL de ellas se restablece.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_user", nullable = false)
    private User user;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Builder.Default
    @Column(nullable = false)
    private Boolean usado = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public boolean estaVigente() {
        return Boolean.FALSE.equals(usado) && LocalDateTime.now().isBefore(expiresAt);
    }
}
