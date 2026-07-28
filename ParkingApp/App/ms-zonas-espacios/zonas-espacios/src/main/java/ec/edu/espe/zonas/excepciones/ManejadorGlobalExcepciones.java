package ec.edu.espe.zonas.excepciones;

import com.fasterxml.jackson.databind.JsonMappingException.Reference;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Traduce las excepciones del dominio a códigos HTTP.
 *
 * Sin esto todo salía como 500: el cliente no podía distinguir "el espacio no
 * existe" de "el espacio existe pero está ocupado", y ms-tickets no tenía forma
 * de propagar un 409 al usuario final.
 */
@RestControllerAdvice
public class ManejadorGlobalExcepciones {

    private static final Logger log = LoggerFactory.getLogger(ManejadorGlobalExcepciones.class);

    private static ResponseEntity<Map<String, Object>> respuesta(HttpStatus estado, String mensaje) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("timestamp", LocalDateTime.now().toString());
        cuerpo.put("status", estado.value());
        cuerpo.put("error", estado.getReasonPhrase());
        cuerpo.put("message", mensaje);
        return ResponseEntity.status(estado).body(cuerpo);
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<Map<String, Object>> noEncontrado(RecursoNoEncontradoException e) {
        return respuesta(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(ConflictoEstadoException.class)
    public ResponseEntity<Map<String, Object>> conflicto(ConflictoEstadoException e) {
        return respuesta(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(TenantNoAutorizadoException.class)
    public ResponseEntity<Map<String, Object>> tenantAjeno(TenantNoAutorizadoException e) {
        return respuesta(HttpStatus.FORBIDDEN, e.getMessage());
    }

    /**
     * `?estado=INVENTADO` en el cambio de estado: sin este manejador Spring
     * devuelve un 400 sin explicar qué valores son válidos.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> tipoInvalido(MethodArgumentTypeMismatchException e) {
        String mensaje = String.format("Valor inválido para el parámetro '%s'", e.getName());
        if (e.getRequiredType() != null && e.getRequiredType().isEnum()) {
            mensaje += ". Valores admitidos: " + Arrays.stream(e.getRequiredType().getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
        }
        return respuesta(HttpStatus.BAD_REQUEST, mensaje);
    }

    /**
     * Cuerpo JSON ilegible: normalmente un valor que no existe en un enum
     * (`"tipo": "REGULAR"` cuando solo hay GENERAL/PREFERENCIAL/VIP/VISITANTES).
     * Es un error del cliente, así que 400 y no el 500 que salía antes; y el
     * mensaje enumera los valores admitidos para no obligar a mirar el código.
     */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> cuerpoIlegible(HttpMessageNotReadableException e) {
        Throwable causa = e.getCause();
        if (causa instanceof InvalidFormatException formato && formato.getTargetType() != null
                && formato.getTargetType().isEnum()) {
            String campo = formato.getPath().stream()
                    .map(Reference::getFieldName)
                    .filter(Objects::nonNull)
                    .reduce((primero, ultimo) -> ultimo)
                    .orElse("campo");
            String admitidos = Arrays.stream(formato.getTargetType().getEnumConstants())
                    .map(Object::toString)
                    .collect(Collectors.joining(", "));
            return respuesta(HttpStatus.BAD_REQUEST, String.format(
                    "Valor inválido para '%s': %s. Valores admitidos: %s",
                    campo, formato.getValue(), admitidos));
        }
        return respuesta(HttpStatus.BAD_REQUEST, "El cuerpo de la petición no se pudo leer");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validacion(MethodArgumentNotValidException e) {
        String mensaje = e.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return respuesta(HttpStatus.BAD_REQUEST, mensaje.isBlank() ? "Petición inválida" : mensaje);
    }

    /**
     * Red de seguridad para el código que todavía lanza RuntimeException con el
     * mensaje "... no encontrado ...". Se mapea por mensaje en vez de dejarlo
     * caer a 500, que es lo que hacía antes.
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, Object>> runtime(RuntimeException e) {
        String mensaje = e.getMessage() != null ? e.getMessage() : "Error interno";
        if (mensaje.toLowerCase().contains("no encontrad")) {
            return respuesta(HttpStatus.NOT_FOUND, mensaje);
        }
        log.error("Error no controlado: {}", mensaje, e);
        return respuesta(HttpStatus.INTERNAL_SERVER_ERROR, mensaje);
    }
}
