package ec.edu.espe.zonas.excepciones;

/**
 * La operación es válida pero choca con el estado actual del recurso: ocupar un
 * espacio que ya no está libre, ponerlo en mantenimiento con un vehículo
 * dentro, o cualquier otra transición no permitida.
 *
 * Se traduce a HTTP 409 Conflict, que es lo que distingue este caso de un 400
 * (petición mal formada) y de un 404 (el recurso no existe).
 */
public class ConflictoEstadoException extends RuntimeException {

    public ConflictoEstadoException(String mensaje) {
        super(mensaje);
    }
}
