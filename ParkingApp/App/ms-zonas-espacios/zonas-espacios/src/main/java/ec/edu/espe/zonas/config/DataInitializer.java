package ec.edu.espe.zonas.config;

import ec.edu.espe.zonas.entidades.Espacio;
import ec.edu.espe.zonas.entidades.EstadoEspacio;
import ec.edu.espe.zonas.entidades.TipoEspacio;
import ec.edu.espe.zonas.entidades.Zona;
import ec.edu.espe.zonas.repositorios.EspacioRepositorio;
import ec.edu.espe.zonas.repositorios.ZonaRepositorio;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@Profile("!prod") // no correr en perfil prod por seguridad
public class DataInitializer implements CommandLineRunner {

    private final ZonaRepositorio zonaRepositorio;
    private final EspacioRepositorio espacioRepositorio;

    public DataInitializer(ZonaRepositorio zonaRepositorio, EspacioRepositorio espacioRepositorio) {
        this.zonaRepositorio = zonaRepositorio;
        this.espacioRepositorio = espacioRepositorio;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        List<Zona> zonas = zonaRepositorio.findAll();
        for (Zona z : zonas) {
            long cnt = espacioRepositorio.countByZonaId(z.getId());
            if (cnt == 0 && z.getCapacidad() > 0) {
                System.out.println("DataInitializer: creando " + z.getCapacidad() + " espacios para zona " + z.getCodigo());
                List<Espacio> nuevos = new ArrayList<>();
                for (int i = 1; i <= z.getCapacidad(); i++) {
                    Espacio e = Espacio.builder()
                            .nombre(z.getCodigo() + "-" + String.format("%03d", i))
                            .descripcion(null)
                            .tipo(TipoEspacio.AUTO)
                            .estado(EstadoEspacio.DISPONIBLE)
                            .zona(z)
                            .activo(true)
                            .fechaCreacion(LocalDateTime.now())
                            .build();
                    nuevos.add(e);
                }
                espacioRepositorio.saveAll(nuevos);
                espacioRepositorio.flush();
                System.out.println("DataInitializer: creados " + nuevos.size() + " espacios para zona " + z.getCodigo());
            }
        }
    }
}

