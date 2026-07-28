package ec.edu.espe.zonas.entidades;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/**
 * Estados en los que puede encontrarse un espacio de parqueo.
 *
 * MANTENIMIENTO es un estado administrativo: el espacio existe y cuenta para el
 * aforo de la zona, pero no se puede asignar a ningún ticket hasta que vuelva a
 * DISPONIBLE.
 */
public enum EstadoEspacio {
    DISPONIBLE, OCUPADO, RESERVADO, MANTENIMIENTO;

    /**
     * Transiciones permitidas.
     *
     * Las reglas que no son evidentes:
     * - Un espacio OCUPADO solo puede quedar DISPONIBLE, y eso lo hace el cierre
     *   del ticket. Mandarlo a MANTENIMIENTO con un vehículo dentro dejaría al
     *   ticket apuntando a una plaza que el sistema considera fuera de servicio.
     * - Desde MANTENIMIENTO hay que pasar por DISPONIBLE antes de ocupar o
     *   reservar: es la revisión explícita de que la plaza ya se puede usar.
     * - **Ocupar y reservar NO son idempotentes**: no hay `OCUPADO → OCUPADO` ni
     *   `RESERVADO → RESERVADO`. Son tomas de posesión de la plaza, y es
     *   justamente ese rechazo el que decide quién gana cuando dos peticiones
     *   compiten por el mismo espacio. Admitirlas "porque ya estaba en ese
     *   estado" dejaría pasar a las dos.
     * - Liberar y mantener sí lo son: repetir la operación no otorga nada, y el
     *   reintento de un cierre o de una puesta fuera de servicio no debe fallar.
     */
    private static final Map<EstadoEspacio, Set<EstadoEspacio>> TRANSICIONES = Map.of(
            DISPONIBLE, EnumSet.of(DISPONIBLE, OCUPADO, RESERVADO, MANTENIMIENTO),
            OCUPADO, EnumSet.of(DISPONIBLE),
            RESERVADO, EnumSet.of(DISPONIBLE, OCUPADO, MANTENIMIENTO),
            MANTENIMIENTO, EnumSet.of(DISPONIBLE, MANTENIMIENTO)
    );

    public boolean puedeTransicionarA(EstadoEspacio destino) {
        if (destino == null) {
            return false;
        }
        return TRANSICIONES.getOrDefault(this, EnumSet.noneOf(EstadoEspacio.class)).contains(destino);
    }

    /** Un espacio solo se puede asignar a un ticket si está libre. */
    public boolean esAsignable() {
        return this == DISPONIBLE;
    }
}
