package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.repository.PersonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;


@RestController
@RequestMapping("/api/personas")
@RequiredArgsConstructor
public class PersonController {

    private final PersonRepository personRepository;

    // Buscar persona por DNI
    @GetMapping("/{dni}")
    public ResponseEntity<PersonResponse> getByDni(@PathVariable String dni) {
        Person person = personRepository.findByDni(dni)
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

    // Crear una nueva persona
    @PostMapping
    public ResponseEntity<Person> create(@RequestBody Person person) {
        Person nuevaPersona = personRepository.save(person);
        return ResponseEntity.status(HttpStatus.CREATED).body(nuevaPersona);
    }
    @GetMapping
    public ResponseEntity<List<Person>> getAll() {
        return ResponseEntity.ok(personRepository.findAll());
    }
}