package ec.edu.espe.zonas.audit;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public interface OutboxRepositorio extends JpaRepository<OutboxEvent, UUID> {

    /**
     * Eventos aún sin publicar, del más antiguo al más reciente: la auditoría
     * debe conservar el orden en que ocurrieron los hechos, no el orden en que
     * se recuperó el broker.
     *
     * Se toman con bloqueo y SKIP LOCKED (lock.timeout = -2) porque el servicio
     * corre con varias réplicas en Kubernetes: sin esto, dos pods leerían las
     * mismas filas a la vez y publicarían el evento por duplicado. Con SKIP
     * LOCKED cada pod se lleva un lote distinto en lugar de esperarse.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select o from OutboxEvent o where o.enviadoEn is null order by o.creadoEn asc")
    List<OutboxEvent> buscarPendientes(Pageable limite);

    long deleteByEnviadoEnBefore(LocalDateTime limite);
}
