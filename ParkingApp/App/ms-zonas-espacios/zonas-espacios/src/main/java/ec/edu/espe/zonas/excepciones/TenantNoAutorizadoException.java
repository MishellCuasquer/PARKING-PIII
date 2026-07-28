package ec.edu.espe.zonas.excepciones;

/**
 * La petición pide operar sobre un tenant distinto al del token.
 *
 * Se distingue de "recurso no encontrado" a propósito: aquí no se está
 * revelando nada sobre la otra empresa, solo se rechaza una petición
 * internamente contradictoria. Se traduce a HTTP 403.
 */
public class TenantNoAutorizadoException extends RuntimeException {

    public TenantNoAutorizadoException(String mensaje) {
        super(mensaje);
    }
}
