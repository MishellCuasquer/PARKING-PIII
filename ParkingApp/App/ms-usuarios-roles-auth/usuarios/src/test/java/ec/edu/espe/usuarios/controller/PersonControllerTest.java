package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.TenantRepository;
import ec.edu.espe.usuarios.security.CallerContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PersonControllerTest {

    @Mock
    private PersonRepository personRepository;
    @Mock
    private TenantRepository tenantRepository;
    @Mock
    private CallerContext callerContext;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private PersonController personController;

    @Test
    void getByDni_devuelvePersonaCuandoExiste() {
        Person person = Person.builder().id(UUID.randomUUID()).dni("1111111111").firstName("Juan").build();
        when(personRepository.findByDni("1111111111")).thenReturn(Optional.of(person));

        ResponseEntity<PersonResponse> response = personController.getByDni("1111111111");

        assertThat(response.getBody().getDni()).isEqualTo("1111111111");
    }

    @Test
    void getByDni_lanzaNotFoundCuandoNoExiste() {
        when(personRepository.findByDni("0000000000")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> personController.getByDni("0000000000"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void create_guardaPersonaYPublicaAuditoria() {
        Person nueva = Person.builder().id(UUID.randomUUID()).dni("2222222222").firstName("Ana").lastName("Ruiz").build();
        when(personRepository.save(any(Person.class))).thenReturn(nueva);

        ResponseEntity<Person> response = personController.create(new Person());

        assertThat(response.getBody().getDni()).isEqualTo("2222222222");
        verify(auditPublisher).publish(eq("CREATE"), eq("Persona"), anyMap());
    }

    @Test
    void getAll_devuelveTodasLasPersonas() {
        when(personRepository.findAll()).thenReturn(List.of(new Person()));

        ResponseEntity<List<Person>> response = personController.getAll();

        assertThat(response.getBody()).hasSize(1);
    }
}
