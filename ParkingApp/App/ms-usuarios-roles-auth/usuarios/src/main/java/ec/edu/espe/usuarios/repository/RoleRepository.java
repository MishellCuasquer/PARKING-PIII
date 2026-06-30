package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Boolean existsByName(String name);

    Optional<Role> findByName(String name);
}