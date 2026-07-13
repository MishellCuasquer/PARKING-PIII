package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private static final String CAMPO_USERNAME = "username";

    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditPublisher auditPublisher;

    @Override
    public UserResponse createUser(UserCreateRequest userRequest) {

        // Validaciones de unicidad
        if (personRepository.existsByEmail(userRequest.getEmail())) {
            throw new IllegalArgumentException("El email ya existe");
        }
        if (personRepository.existsByDni(userRequest.getDni())) {
            throw new IllegalArgumentException("La identificación DNI ya existe");
        }

        // Creación de Person (middleName/nationality son NOT NULL en BD pero opcionales en el request)
        Person person = Person.builder()
                .dni(userRequest.getDni())
                .firstName(userRequest.getFirstName())
                .middleName(nullToEmpty(userRequest.getMiddleName()))
                .lastName(userRequest.getLastName())
                .email(userRequest.getEmail())
                .phone(userRequest.getPhone())
                .address(userRequest.getAddress())
                .nationality(nullToEmpty(userRequest.getNationality()))
                .build();

        person = personRepository.save(person);

        Role clientRole = roleRepository.findByName("CLIENT")
                .orElseThrow(() -> new IllegalStateException("Rol CLIENT no configurado"));

        User user = User.builder()
                .person(person)
                .username(generarUsername(
                        userRequest.getFirstName(),
                        userRequest.getMiddleName(),
                        userRequest.getLastName()))
                .passwordHash(passwordEncoder.encode(userRequest.getDni()))
                .role(clientRole)
                .build();

        User savedUser = userRepository.save(user);

        auditPublisher.publish("CREATE", "User", Map.of(
                "id", savedUser.getId(),
                CAMPO_USERNAME, savedUser.getUsername()
        ));

        return mapToUserResponse(savedUser);
    }

    @Override
    @Transactional (readOnly = true)
    public List<UserResponse> getUsers() {

        return userRepository.findAll().stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList()
        );
    }

    @Override
    @Transactional(readOnly = true)
        public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + id));
        return mapToUserResponse(user);
    }

    // Asigna un rol a un usuario, reemplazando el rol anterior (un usuario = un solo rol activo)
    @Override
    public UserResponse assignRole(UUID userId, UUID roleId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rol no encontrado"));

        if (user.getRole() != null && roleId.equals(user.getRole().getId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "El rol ya está asignado al usuario");
        }

        user.setRole(role);
        userRepository.save(user);

        auditPublisher.publish("UPDATE", "User", Map.of(
                "id", user.getId(),
                CAMPO_USERNAME, user.getUsername(),
                "role", role.getName()
        ));

        return mapToUserResponse(user);
    }


    @Override
    public UserResponse updateUser(UUID userId, UserUpdateRequest userRequest) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Person person = user.getPerson();

        personRepository.findByEmail(userRequest.getEmail())
                .filter(existing -> !existing.getId().equals(person.getId()))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está en uso");
                });

        if (userRequest.getPhone() != null && !userRequest.getPhone().isBlank()) {
            personRepository.findByPhone(userRequest.getPhone())
                    .filter(existing -> !existing.getId().equals(person.getId()))
                    .ifPresent(existing -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "El teléfono ya está en uso");
                    });
        }

        person.setFirstName(userRequest.getFirstName());
        person.setMiddleName(nullToEmpty(userRequest.getMiddleName()));
        person.setLastName(userRequest.getLastName());
        person.setEmail(userRequest.getEmail());
        person.setPhone(userRequest.getPhone());
        person.setAddress(userRequest.getAddress());
        person.setNationality(nullToEmpty(userRequest.getNationality()));

        personRepository.save(person);

        auditPublisher.publish("UPDATE", "User", Map.of(
                "id", user.getId(),
                CAMPO_USERNAME, user.getUsername()
        ));

        return mapToUserResponse(user);
    }

    // Método privado helper para mapear User -> UserResponse
    private UserResponse mapToUserResponse(User user) {
        List<String> roles = user.getRole() != null
                ? Collections.singletonList(user.getRole().getName())
                : Collections.emptyList();

        Person person = user.getPerson();

        PersonResponse personResponse = PersonResponse.builder()
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

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .active(user.getActive())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .person(personResponse)
                .roles(roles)
                .build();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String generarUsername(String fn, String mn, String ln) {
        String[] partes = ln.split(" ");

        // Protege contra middleName null o vacío
        char segundaInicial = (mn != null && !mn.isEmpty()) ? mn.charAt(0) : fn.charAt(1);

        // Protege contra lastName con una sola palabra
        String username = "" + fn.charAt(0) + segundaInicial + partes[0];
        if (partes.length > 1) {
            username += partes[1].charAt(0);
        }

        username = username.toLowerCase();

        if (userRepository.findByUsernameWithRole(username).isPresent()) {
            // Username exists, append a number to make it unique
            int counter = 1;
            String newUsername = username + counter;
            while (userRepository.findByUsernameWithRole(newUsername).isPresent()) {
                counter++;
                newUsername = username + counter;
            }
            username = newUsername;
        }

        return username;
    }


    }
