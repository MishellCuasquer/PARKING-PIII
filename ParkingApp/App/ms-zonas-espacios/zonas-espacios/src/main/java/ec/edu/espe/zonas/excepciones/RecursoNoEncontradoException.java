package ec.edu.espe.zonas.excepciones;

/**
 * El recurso no existe, o pertenece a otra empresa.
 *
 * Los dos casos comparten excepción a propósito: responder "no existe" ante un
 * recurso ajeno evita confirmar a un tenant qué identificadores tienen los
 * demás.
 *
 * Extiende RuntimeException para no romper el código (ni los tests) que ya
 * esperaba una RuntimeException genérica.
 */
public class RecursoNoEncontradoException extends RuntimeException {

    public RecursoNoEncontradoException(String mensaje) {
        super(mensaje);
    }
}
