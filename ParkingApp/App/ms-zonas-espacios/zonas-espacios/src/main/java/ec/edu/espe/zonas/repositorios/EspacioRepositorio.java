package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EspacioRepositorio extends JpaRepository<Espacio, UUID> {
    // Buscar espacios por id de zona (ruta de propiedad: zona.id)
    List<Espacio> findByZonaId(UUID idZona);

    // Buscar espacios por id de zona y estado (estado como enum)
    List<Espacio> findByZonaIdAndEstado(UUID idZona, EstadoEspacio estado);

    // Buscar espacios por estado (enum)
    List<Espacio> findByEstado(EstadoEspacio estado);

    // Contar espacios por zona (más eficiente que traer la colección completa)
    long countByZonaId(UUID idZona);

    long countByZonaIdAndEstado(UUID idZona, EstadoEspacio estado);

    boolean existsByNombre(String nombre);

    // Variantes por tenant
    List<Espacio> findByIdTenant(UUID idTenant);

    List<Espacio> findByEstadoAndIdTenant(EstadoEspacio estado, UUID idTenant);

    boolean existsByNombreAndIdTenant(String nombre, UUID idTenant);

    /**
     * Devuelve el espacio con bloqueo pesimista de escritura.
     *
     * Es lo que serializa dos peticiones que compiten por la misma plaza: la
     * segunda espera a que la primera confirme su transacción y entonces lee el
     * estado ya actualizado, en vez de decidir sobre una lectura obsoleta.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Espacio e where e.id = :id")
    Optional<Espacio> findByIdForUpdate(UUID id);

}
