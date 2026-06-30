package ec.edu.espe.zonas.repositorios;

import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
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

}
