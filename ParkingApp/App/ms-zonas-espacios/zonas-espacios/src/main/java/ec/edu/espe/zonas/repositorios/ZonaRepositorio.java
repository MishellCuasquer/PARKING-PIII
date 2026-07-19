package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ZonaRepositorio extends JpaRepository<Zona, UUID> {
    boolean existsByNombre(String nombre);
    boolean existsByCodigo(String codigo);
    long countByTipo(TipoZona tipo);

    // Variantes por tenant
    List<Zona> findByIdTenant(UUID idTenant);
    boolean existsByNombreAndIdTenant(String nombre, UUID idTenant);
    boolean existsByCodigoAndIdTenant(String codigo, UUID idTenant);
    long countByTipoAndIdTenant(TipoZona tipo, UUID idTenant);

    // Devuelve la zona con bloqueo pesimista para evitar condiciones de carrera
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select z from Zona z where z.id = :id")
    Optional<Zona> findByIdForUpdate(UUID id);

}
