package ec.edu.espe.zonas;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

// @EnableScheduling: lo necesita el reintento periódico de la outbox de auditoría
@SpringBootApplication
@EnableScheduling
public class ZonasEspaciosApplication {

	public static void main(String[] args) {
		SpringApplication.run(ZonasEspaciosApplication.class, args);
	}

}
