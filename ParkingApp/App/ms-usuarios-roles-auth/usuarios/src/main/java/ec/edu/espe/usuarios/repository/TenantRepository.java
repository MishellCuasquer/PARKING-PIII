package ec.edu.espe.usuarios.repository;

import ec.edu.espe.usuarios.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);

    boolean existsByNombre(String nombre);

    List<Tenant> findByActivoTrue();
}
