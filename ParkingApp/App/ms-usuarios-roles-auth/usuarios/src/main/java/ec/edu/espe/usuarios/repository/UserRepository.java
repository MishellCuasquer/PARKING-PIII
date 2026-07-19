package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Boolean existsByUsername(String username);

    Optional<User> findByUsername(String username);

    // Fetch join de person/tenant para poder leer el tenant en login sin LazyInitializationException
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role LEFT JOIN FETCH u.person p LEFT JOIN FETCH p.tenant WHERE u.username = :username")
    Optional<User> findByUsernameWithRole(String username);

    List<User> findByPerson_Tenant_Id(UUID tenantId);

    // Login por correo: el mismo email puede tener una cuenta por empresa
    @Query("SELECT u FROM User u LEFT JOIN FETCH u.role LEFT JOIN FETCH u.person p LEFT JOIN FETCH p.tenant WHERE p.email = :email ORDER BY u.username")
    List<User> findAllByPersonEmailWithRole(String email);

    @Query(value = "SELECT * FROM users WHERE LOWER (username) LIKE LOWER (CONCAT('%', :username, '%'))", nativeQuery = true)
    List<User> findByUsernameContainingIgnoreCase(String username);
}