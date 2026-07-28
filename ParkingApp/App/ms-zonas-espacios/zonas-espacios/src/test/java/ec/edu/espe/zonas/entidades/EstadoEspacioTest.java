package ec.edu.espe.zonas.entidades;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class EstadoEspacioTest {

    @Test
    void existenLosCuatroEstadosDeLaRubrica() {
        assertThat(EstadoEspacio.values()).containsExactlyInAnyOrder(
                EstadoEspacio.DISPONIBLE,
                EstadoEspacio.OCUPADO,
                EstadoEspacio.RESERVADO,
                EstadoEspacio.MANTENIMIENTO);
    }

    @ParameterizedTest
    @CsvSource({
            "DISPONIBLE, OCUPADO",
            "DISPONIBLE, RESERVADO",
            "DISPONIBLE, MANTENIMIENTO",
            "OCUPADO, DISPONIBLE",
            "RESERVADO, OCUPADO",
            "RESERVADO, DISPONIBLE",
            "RESERVADO, MANTENIMIENTO",
            "MANTENIMIENTO, DISPONIBLE",
    })
    void transicionesPermitidas(EstadoEspacio origen, EstadoEspacio destino) {
        assertThat(origen.puedeTransicionarA(destino)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            // Un vehiculo dentro impide sacar la plaza de servicio o reservarla
            "OCUPADO, MANTENIMIENTO",
            "OCUPADO, RESERVADO",
            // De mantenimiento hay que pasar por DISPONIBLE: es la revision explicita
            "MANTENIMIENTO, OCUPADO",
            "MANTENIMIENTO, RESERVADO",
    })
    void transicionesProhibidas(EstadoEspacio origen, EstadoEspacio destino) {
        assertThat(origen.puedeTransicionarA(destino)).isFalse();
    }

    /**
     * Es la regla que decide la carrera del escenario 3: si ocupar un espacio ya
     * ocupado se admitiera "porque ya estaba asi", dos peticiones simultaneas
     * ganarian las dos y quedarian dos tickets sobre la misma plaza.
     */
    @Test
    void ocuparYReservarNoSonIdempotentes() {
        assertThat(EstadoEspacio.OCUPADO.puedeTransicionarA(EstadoEspacio.OCUPADO)).isFalse();
        assertThat(EstadoEspacio.RESERVADO.puedeTransicionarA(EstadoEspacio.RESERVADO)).isFalse();
    }

    /** Liberar o mantener sí se puede repetir: el reintento no otorga nada. */
    @Test
    void liberarYMantenerSonIdempotentes() {
        assertThat(EstadoEspacio.DISPONIBLE.puedeTransicionarA(EstadoEspacio.DISPONIBLE)).isTrue();
        assertThat(EstadoEspacio.MANTENIMIENTO.puedeTransicionarA(EstadoEspacio.MANTENIMIENTO)).isTrue();
    }

    @Test
    void destinoNuloNoEsUnaTransicionValida() {
        assertThat(EstadoEspacio.DISPONIBLE.puedeTransicionarA(null)).isFalse();
    }

    @Test
    void soloElEspacioDisponibleEsAsignableAUnTicket() {
        assertThat(EstadoEspacio.DISPONIBLE.esAsignable()).isTrue();
        assertThat(EstadoEspacio.OCUPADO.esAsignable()).isFalse();
        assertThat(EstadoEspacio.RESERVADO.esAsignable()).isFalse();
        assertThat(EstadoEspacio.MANTENIMIENTO.esAsignable()).isFalse();
    }
}
