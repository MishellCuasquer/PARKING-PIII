package ec.edu.espe.zonas.audit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuditPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private AuditPublisher auditPublisher;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(auditPublisher, "exchangeName", "exchange_audit");
        ReflectionTestUtils.setField(auditPublisher, "routingKey", "routing_audit");
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void publish_envuelveElEventoConUsuarioSystemFueraDeUnRequest() {
        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }

    @Test
    void publish_noPropagaExcepcionesDelBrokerDeMensajeria() {
        doThrow(new RuntimeException("broker caido"))
                .when(rabbitTemplate)
                .convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }

    @Test
    void publish_usaElNombreDelUsuarioAutenticado() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("jperez", "pass"));

        auditPublisher.publish("UPDATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }

    @Test
    void publish_tomaLaIpDeXForwardedForCuandoEstaPresente() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "200.1.1.1, 10.0.0.2");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }

    @Test
    void publish_tomaLaIpDeXRealIpCuandoNoHayXForwardedFor() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Real-IP", "200.2.2.2");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }

    @Test
    void publish_usaLaIpRemotaCuandoNoHayCabecerasDeProxy() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("10.0.0.9");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        auditPublisher.publish("CREATE", "Zona", Map.of("id", "1"));

        verify(rabbitTemplate).convertAndSend(eq("exchange_audit"), eq("routing_audit"), any(AuditEvent.class));
    }
}
