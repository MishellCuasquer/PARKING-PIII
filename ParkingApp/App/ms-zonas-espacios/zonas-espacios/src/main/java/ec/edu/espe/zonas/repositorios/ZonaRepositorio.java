package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.TipoZona;
import ec.edu.espe.zonas.entidades.Zona;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

public interface ZonaRepositorio extends JpaRepository<Zona, UUID> {
    boolean existsByNombre(String nombre);
    long countByTipo(TipoZona tipo);

    // Devuelve la zona con bloqueo pesimista para evitar condiciones de carrera
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select z from Zona z where z.id = :id")
    Optional<Zona> findByIdForUpdate(UUID id);

}
