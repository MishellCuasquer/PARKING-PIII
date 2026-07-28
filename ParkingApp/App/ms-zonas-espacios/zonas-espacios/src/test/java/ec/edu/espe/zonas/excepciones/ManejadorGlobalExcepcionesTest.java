package ec.edu.espe.zonas.excepciones;

import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoZona;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ManejadorGlobalExcepcionesTest {

    private final ManejadorGlobalExcepciones manejador = new ManejadorGlobalExcepciones();

    private static String mensaje(ResponseEntity<Map<String, Object>> respuesta) {
        return String.valueOf(respuesta.getBody().get("message"));
    }

    @Test
    void recursoNoEncontrado_devuelve404() {
        ResponseEntity<Map<String, Object>> r =
                manejador.noEncontrado(new RecursoNoEncontradoException("Espacio no encontrado con id: 1"));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(mensaje(r)).contains("no encontrado");
    }

    @Test
    void conflictoDeEstado_devuelve409() {
        ResponseEntity<Map<String, Object>> r =
                manejador.conflicto(new ConflictoEstadoException("El espacio no está disponible (estado: ocupado)"));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(mensaje(r)).contains("ocupado");
    }

    @Test
    void tenantAjeno_devuelve403() {
        ResponseEntity<Map<String, Object>> r =
                manejador.tenantAjeno(new TenantNoAutorizadoException("El tenant solicitado no coincide"));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    /** `?estado=INVENTADO` debe explicar que valores existen. */
    @Test
    void parametroDeTipoInvalido_devuelve400ConLosValoresAdmitidos() {
        MethodArgumentTypeMismatchException error = new MethodArgumentTypeMismatchException(
                "INVENTADO", EstadoEspacio.class, "estado", null, new IllegalArgumentException());

        ResponseEntity<Map<String, Object>> r = manejador.tipoInvalido(error);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mensaje(r)).contains("estado", "DISPONIBLE", "OCUPADO", "RESERVADO", "MANTENIMIENTO");
    }

    /**
     * Un enum invalido en el CUERPO ("tipo": "REGULAR") salia como 500 porque
     * Jackson falla antes de llegar al controlador. Es un error del cliente.
     */
    @Test
    void enumInvalidoEnElCuerpo_devuelve400ConLosValoresAdmitidos() {
        InvalidFormatException causa =
                InvalidFormatException.from(null, "valor no valido", "REGULAR", TipoZona.class);
        causa.prependPath(new Object(), "tipo");
        HttpMessageNotReadableException error = new HttpMessageNotReadableException(
                "JSON parse error", causa, new MockHttpInputMessage("{}".getBytes(StandardCharsets.UTF_8)));

        ResponseEntity<Map<String, Object>> r = manejador.cuerpoIlegible(error);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mensaje(r)).contains("tipo", "REGULAR", "GENERAL", "PREFERENCIAL", "VIP", "VISITANTES");
    }

    @Test
    void cuerpoIlegibleSinCausaDeEnum_devuelve400Generico() {
        HttpMessageNotReadableException error = new HttpMessageNotReadableException(
                "roto", new MockHttpInputMessage("{".getBytes(StandardCharsets.UTF_8)));

        ResponseEntity<Map<String, Object>> r = manejador.cuerpoIlegible(error);

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mensaje(r)).contains("no se pudo leer");
    }

    /** Red de seguridad para el codigo que aun lanza RuntimeException por mensaje. */
    @Test
    void runtimeConMensajeDeNoEncontrado_devuelve404() {
        ResponseEntity<Map<String, Object>> r =
                manejador.runtime(new RuntimeException("Zona no encontrada con id: 7"));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void runtimeInesperado_devuelve500() {
        ResponseEntity<Map<String, Object>> r =
                manejador.runtime(new RuntimeException("fallo raro"));

        assertThat(r.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @Test
    void laRespuestaLlevaTimestampYEstado() {
        ResponseEntity<Map<String, Object>> r =
                manejador.conflicto(new ConflictoEstadoException("choque"));

        assertThat(r.getBody()).containsKeys("timestamp", "status", "error", "message");
        assertThat(r.getBody().get("status")).isEqualTo(409);
    }
}
