package ec.edu.espe.zonas.audit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuditPublisherTest {

    @Mock
    private OutboxRepositorio outboxRepositorio;

    @Mock
    private OutboxDespachador outboxDespachador;

    private AuditPublisher auditPublisher;

    @BeforeEach
    void setUp() {
        // El save de la outbox devuelve la misma fila que recibe
        when(outboxRepositorio.save(any(OutboxEvent.class)))
                .thenAnswer(invocacion -> invocacion.getArgument(0));
        when(outboxDespachador.publicar(any(OutboxEvent.class))).thenReturn(true);

        auditPublisher = new AuditPublisher(outboxRepositorio, outboxDespachador);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    private OutboxEvent capturarFilaGuardada() {
        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxRepositorio).save(captor.capture());
        return captor.getValue();
    }

    @Test
    void publish_registraElEventoEnLaOutboxYLoDespacha() {
        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        OutboxEvent fila = capturarFilaGuardada();
        assertThat(fila.getEnviadoEn()).isNull();
        assertThat(fila.getCreadoEn()).isNotNull();
        assertThat(fila.getPayload()).contains("\"accion\":\"CREATE\"", "\"entidad\":\"Zona\"");
        verify(outboxDespachador).publicar(any(OutboxEvent.class));
    }

    @Test
    void publish_usaUsuarioSystemFueraDeUnRequest() {
        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"usuario\":\"system\"");
    }

    /**
     * El evento debe quedar guardado igualmente: es justo el caso que el patrón
     * outbox existe para cubrir (broker caído → se reintenta después).
     */
    @Test
    void publish_conservaElEventoAunqueElBrokerNoResponda() {
        when(outboxDespachador.publicar(any(OutboxEvent.class))).thenReturn(false);

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getEnviadoEn()).isNull();
    }

    @Test
    void publish_noPropagaExcepcionesDelBrokerDeMensajeria() {
        when(outboxDespachador.publicar(any(OutboxEvent.class)))
                .thenThrow(new RuntimeException("broker caido"));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(outboxRepositorio).save(any(OutboxEvent.class));
    }

    /**
     * El constructor de 3 argumentos es el que marca el token como autenticado;
     * el de 2 deja isAuthenticated() en false y el evento saldría como "system".
     */
    @Test
    void publish_usaElNombreDelUsuarioAutenticado() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("jperez", "pass", List.of()));

        auditPublisher.publish("UPDATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"usuario\":\"jperez\"");
    }

    @Test
    void publish_usaSystemSiElTokenNoEstaAutenticado() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("jperez", "pass"));

        auditPublisher.publish("UPDATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"usuario\":\"system\"");
    }

    @Test
    void publish_tomaLaIpDeXForwardedForCuandoEstaPresente() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "200.1.1.1, 10.0.0.2");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"ip\":\"200.1.1.1\"");
    }

    @Test
    void publish_tomaLaIpDeXRealIpCuandoNoHayXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "200.2.2.2");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"ip\":\"200.2.2.2\"");
    }

    @Test
    void publish_usaLaIpRemotaCuandoNoHayCabecerasDeProxy() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.9");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        assertThat(capturarFilaGuardada().getPayload()).contains("\"ip\":\"10.0.0.9\"");
    }
}
