package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.TenantRepository;
import ec.edu.espe.usuarios.security.CallerContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;


@RestController
@RequestMapping("/api/personas")
@RequiredArgsConstructor
public class PersonController {

    private final PersonRepository personRepository;
    private final TenantRepository tenantRepository;
    private final CallerContext callerContext;
    private final AuditPublisher auditPublisher;

    // Buscar persona por DNI (scoped: cada empresa solo ve sus personas; cuentas globales ven todo)
    @GetMapping("/{dni}")
    public ResponseEntity<PersonResponse> getByDni(@PathVariable String dni) {
        UUID callerTenantId = callerContext.callerTenantId();
        Person person = (callerTenantId != null
                ? personRepository.findByDniAndTenant_Id(dni, callerTenantId)
                : personRepository.findByDni(dni))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Persona no encontrada con DNI: " + dni));

        PersonResponse response = PersonResponse.builder()
                .id(person.getId())
                .dni(person.getDni())
                .firstName(person.getFirstName())
                .middleName(person.getMiddleName())
                .lastName(person.getLastName())
                .email(person.getEmail())
                .phone(person.getPhone())
                .address(person.getAddress())
                .nationality(person.getNationality())
                .active(person.getActive())
                .build();

        return ResponseEntity.ok(response);
    }

    // Crear una nueva persona: queda asociada al tenant del caller.
    // La misma persona puede existir en otra empresa; el duplicado solo se
    // rechaza dentro del mismo tenant y con 409 (no con el error crudo de la BD).
    @PostMapping
    public ResponseEntity<Person> create(@RequestBody Person person) {
        UUID callerTenantId = callerContext.callerTenantId();
        if (callerTenantId != null) {
            person.setTenant(tenantRepository.findById(callerTenantId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.BAD_REQUEST, "El tenant del solicitante no existe")));

            if (person.getDni() != null
                    && personRepository.existsByDniAndTenant_Id(person.getDni(), callerTenantId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ya existe una persona con ese DNI en esta empresa");
            }
            if (person.getEmail() != null
                    && personRepository.existsByEmailAndTenant_Id(person.getEmail(), callerTenantId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ya existe una persona con ese email en esta empresa");
            }
            if (person.getPhone() != null
                    && personRepository.findByPhoneAndTenant_Id(person.getPhone(), callerTenantId).isPresent()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "Ya existe una persona con ese teléfono en esta empresa");
            }
        }
        Person nuevaPersona = personRepository.save(person);

        auditPublisher.publish("CREATE", "Persona", Map.of(
                "id", nuevaPersona.getId(),
                "dni", nuevaPersona.getDni(),
                "firstName", nuevaPersona.getFirstName(),
                "lastName", nuevaPersona.getLastName()
        ));

        return ResponseEntity.status(HttpStatus.CREATED).body(nuevaPersona);
    }

    @GetMapping
    public ResponseEntity<List<Person>> getAll() {
        UUID callerTenantId = callerContext.callerTenantId();
        List<Person> personas = callerTenantId != null
                ? personRepository.findByTenant_Id(callerTenantId)
                : personRepository.findAll();
        return ResponseEntity.ok(personas);
    }
}
