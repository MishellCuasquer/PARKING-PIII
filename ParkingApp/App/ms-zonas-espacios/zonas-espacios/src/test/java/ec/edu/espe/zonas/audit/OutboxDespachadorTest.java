package ec.edu.espe.zonas.audit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OutboxDespachadorTest {

    private static final String PAYLOAD = "{\"servicio\":\"ms-zonas\",\"accion\":\"CREATE\"}";

    @Mock
    private OutboxRepositorio outboxRepositorio;

    @Mock
    private RabbitTemplate rabbitTemplate;

    private OutboxDespachador despachador;

    @BeforeEach
    void setUp() {
        despachador = new OutboxDespachador(outboxRepositorio, rabbitTemplate);
        ReflectionTestUtils.setField(despachador, "exchangeName", "exchange_audit");
        ReflectionTestUtils.setField(despachador, "routingKey", "routing_audit");
        when(outboxRepositorio.save(any(OutboxEvent.class)))
                .thenAnswer(invocacion -> invocacion.getArgument(0));
    }

    private OutboxEvent pendiente() {
        return OutboxEvent.builder()
                .id(UUID.randomUUID())
                .payload(PAYLOAD)
                .creadoEn(LocalDateTime.now())
                .intentos(0)
                .build();
    }

    /**
     * El payload ya es JSON: debe viajar como bytes, sin pasar por el
     * convertidor de mensajes. Si se re-serializara, el consumidor recibiría una
     * cadena escapada y el evento acabaría en la dead-letter queue.
     */
    @Test
    void publicar_envíaElPayloadTalCualComoJsonPersistente() {
        OutboxEvent evento = pendiente();

        boolean resultado = despachador.publicar(evento);

        assertThat(resultado).isTrue();
        ArgumentCaptor<Message> captor = ArgumentCaptor.forClass(Message.class);
        verify(rabbitTemplate).send(eq("exchange_audit"), eq("routing_audit"), captor.capture());

        Message mensaje = captor.getValue();
        assertThat(new String(mensaje.getBody(), StandardCharsets.UTF_8)).isEqualTo(PAYLOAD);
        assertThat(mensaje.getMessageProperties().getContentType()).isEqualTo("application/json");
        assertThat(mensaje.getMessageProperties().getDeliveryMode())
                .isEqualTo(MessageDeliveryMode.PERSISTENT);
    }

    @Test
    void publicar_marcaElEventoComoEnviado() {
        OutboxEvent evento = pendiente();

        despachador.publicar(evento);

        assertThat(evento.getEnviadoEn()).isNotNull();
        assertThat(evento.getUltimoError()).isNull();
        verify(outboxRepositorio).save(evento);
    }

    /** Con el broker caído la fila se queda pendiente para el siguiente barrido. */
    @Test
    void publicar_dejaElEventoPendienteSiElBrokerFalla() {
        OutboxEvent evento = pendiente();
        doThrow(new RuntimeException("broker caido"))
                .when(rabbitTemplate).send(anyString(), anyString(), any(Message.class));

        boolean resultado = despachador.publicar(evento);

        assertThat(resultado).isFalse();
        assertThat(evento.getEnviadoEn()).isNull();
        assertThat(evento.getIntentos()).isEqualTo(1);
        assertThat(evento.getUltimoError()).contains("broker caido");
        verify(outboxRepositorio).save(evento);
    }

    @Test
    void despacharPendientes_publicaTodosLosPendientes() {
        when(outboxRepositorio.buscarPendientes(any(Pageable.class)))
                .thenReturn(List.of(pendiente(), pendiente(), pendiente()));

        despachador.despacharPendientes();

        verify(rabbitTemplate, times(3)).send(anyString(), anyString(), any(Message.class));
    }

    /**
     * Si el broker sigue sin responder no tiene sentido insistir con el resto
     * del lote: se corta y se reintenta entero en el siguiente barrido.
     */
    @Test
    void despacharPendientes_seDetieneAlPrimerFallo() {
        when(outboxRepositorio.buscarPendientes(any(Pageable.class)))
                .thenReturn(List.of(pendiente(), pendiente(), pendiente()));
        doThrow(new RuntimeException("broker caido"))
                .when(rabbitTemplate).send(anyString(), anyString(), any(Message.class));

        despachador.despacharPendientes();

        verify(rabbitTemplate, times(1)).send(anyString(), anyString(), any(Message.class));
    }

    @Test
    void despacharPendientes_noHaceNadaSiNoHayPendientes() {
        when(outboxRepositorio.buscarPendientes(any(Pageable.class))).thenReturn(List.of());

        despachador.despacharPendientes();

        verify(rabbitTemplate, never()).send(anyString(), anyString(), any(Message.class));
    }

    @Test
    void publicar_recortaLosMensajesDeErrorLargos() {
        OutboxEvent evento = pendiente();
        doThrow(new RuntimeException("x".repeat(900)))
                .when(rabbitTemplate).send(anyString(), anyString(), any(Message.class));

        despachador.publicar(evento);

        assertThat(evento.getUltimoError()).hasSize(500);
    }

    @Test
    void purgarEnviados_borraLosEnviadosDeMasDeUnDia() {
        when(outboxRepositorio.deleteByEnviadoEnBefore(any(LocalDateTime.class))).thenReturn(7L);

        despachador.purgarEnviados();

        verify(outboxRepositorio).deleteByEnviadoEnBefore(any(LocalDateTime.class));
    }
}
