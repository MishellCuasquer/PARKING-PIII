package ec.edu.espe.zonas.config;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.stream.Collectors;

import ec.edu.espe.zonas.entidades.EstadoEspacio;

/**
 * Amplía la columna `estado` de la tabla `espacio` con los valores del enum.
 *
 * Hace falta porque Hibernate mapea `@Enumerated(STRING)` a un tipo ENUM nativo
 * de MySQL, y `ddl-auto: update` **no modifica un ENUM ya existente**: en una
 * base de datos creada antes de añadir MANTENIMIENTO, guardar ese estado falla
 * con "Data truncated for column 'estado'".
 *
 * En una base nueva Hibernate ya crea el ENUM completo y este ALTER no cambia
 * nada. Es idempotente, así que puede ejecutarse en cada arranque.
 */
// Order muy bajo: tiene que correr antes que DataInitializer, que ya inserta
// espacios. Como ApplicationRunner, se ejecuta cuando Hibernate ya creó el
// esquema, cosa que un @PostConstruct no garantiza.
@Component
@Order(0)
@RequiredArgsConstructor
public class MigracionEstadoEspacio implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MigracionEstadoEspacio.class);

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(ApplicationArguments args) {
        String valores = Arrays.stream(EstadoEspacio.values())
                .map(estado -> "'" + estado.name() + "'")
                .collect(Collectors.joining(","));
        try {
            jdbcTemplate.execute("ALTER TABLE espacio MODIFY COLUMN estado ENUM(" + valores + ")");
            log.info("Columna espacio.estado alineada con el enum: {}", valores);
        } catch (Exception e) {
            // La tabla puede no existir todavía en el primerísimo arranque, o el
            // motor puede no ser MySQL (tests con H2): no es motivo para no arrancar.
            log.warn("No se pudo alinear espacio.estado ({}). Si la tabla acaba de crearse, ya es correcta.",
                    e.getMessage());
        }
    }
}
