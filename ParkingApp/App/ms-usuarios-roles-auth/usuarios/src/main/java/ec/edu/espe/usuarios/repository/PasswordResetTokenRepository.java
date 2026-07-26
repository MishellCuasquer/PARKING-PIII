package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.PasswordResetToken;
import ec.edu.espe.usuarios.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    // Fetch join del usuario: el restablecimiento necesita leerlo fuera de la
    // sesion de Hibernate y sin esto salta LazyInitializationException.
    @Query("SELECT t FROM PasswordResetToken t JOIN FETCH t.user WHERE t.tokenHash = :tokenHash")
    Optional<PasswordResetToken> findByTokenHash(@Param("tokenHash") String tokenHash);

    /**
     * Invalida los tokens anteriores de una cuenta. Se llama al emitir uno
     * nuevo: pedir el enlace dos veces no debe dejar dos enlaces validos.
     */
    @Modifying
    @Query("UPDATE PasswordResetToken t SET t.usado = true WHERE t.user = :user AND t.usado = false")
    void invalidarPendientesDe(@Param("user") User user);
}
