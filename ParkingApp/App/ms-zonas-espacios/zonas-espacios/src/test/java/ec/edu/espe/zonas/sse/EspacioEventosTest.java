package ec.edu.espe.zonas.sse;

import ec.edu.espe.zonas.dto.response.EspacioResponseDto;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EspacioEventosTest {

    private final EspacioEventos eventos = new EspacioEventos();

    @Test
    void suscribir_registraAlClienteYEnviaEventoInicial() {
        SseEmitter emitter = eventos.suscribir();

        assertThat(emitter).isNotNull();
        assertThat(eventos.suscriptores()).isEqualTo(1);
    }

    @Test
    void publicar_entregaElEventoALosSuscriptoresActivos() {
        eventos.suscribir();

        eventos.publicar("RESERVAR", new EspacioResponseDto(), UUID.randomUUID());

        assertThat(eventos.suscriptores()).isEqualTo(1);
    }

    @Test
    void publicar_conTenantNuloNoFalla() {
        eventos.suscribir();

        eventos.publicar("LIBERAR", new EspacioResponseDto(), null);

        assertThat(eventos.suscriptores()).isEqualTo(1);
    }

    @Test
    void publicar_remueveALosSuscriptoresDesconectados() {
        SseEmitter emitter = eventos.suscribir();
        emitter.complete();

        eventos.publicar("OCUPAR", new EspacioResponseDto(), UUID.randomUUID());

        assertThat(eventos.suscriptores()).isZero();
    }
}
