package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.repository.UserRoleRepository;
import ec.edu.espe.usuarios.services.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final UserRoleRepository userRoleRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserResponse createUser(UserCreateRequest userRequest) {

        // Validaciones de unicidad
        if (personRepository.existsByEmail(userRequest.getEmail())) {
            throw new IllegalArgumentException("El email ya existe");
        }
        if (personRepository.existsByDni(userRequest.getDni())) {
            throw new IllegalArgumentException("La identificación DNI ya existe");
        }

        // Creación de Person
        Person person = Person.builder()
                .dni(userRequest.getDni())
                .firstName(userRequest.getFirstName())
                .middleName(userRequest.getMiddleName())
                .lastName(userRequest.getLastName())
                .email(userRequest.getEmail())
                .phone(userRequest.getPhone())
                .address(userRequest.getAddress())
                .nationality(userRequest.getNationality())
                .build();

        person = personRepository.save(person);

        User user = User.builder()
                //.id(person.getId())
                .person(person)
                .username(generarUsername(
                        userRequest.getFirstName(),
                        userRequest.getMiddleName(),
                        userRequest.getLastName()))
                .passwordHash(passwordEncoder.encode(userRequest.getDni()))
                .build();

        User savedUser = userRepository.save(user);

        roleRepository.findByName("CLIENT").ifPresent(clientRole -> {
            UserRoleId userRoleId = new UserRoleId(savedUser.getId(), clientRole.getId());
            userRoleRepository.save(UserRole.builder()
                    .id(userRoleId)
                    .user(savedUser)
                    .role(clientRole)
                    .active(true)
                    .build());
        });

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

    //asignar el rol a una persona
    @Override
    public UserResponse assignRole(UUID userId, UUID roleId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));

        Role role = roleRepository.findById(roleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Rol no encontrado"));

        // Validar si ya existe la relación
        if (userRoleRepository.existsByUserIdAndRoleId(userId, roleId)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "El rol ya está asignado al usuario");
        }

        // Crear ID compuesto
        UserRoleId userRoleId = new UserRoleId(userId, roleId);

        // Crear relación
        UserRole userRole = UserRole.builder()
                .id(userRoleId)
                .user(user)
                .role(role)
                .active(true)
                .build();
        //user.getUserRoles().add(userRole);

        userRoleRepository.save(userRole);

        // Retornar respuesta mapeada
        return mapToUserResponse(user);
    }


    // Método privado helper para mapear User -> UserResponse
    private UserResponse mapToUserResponse(User user) {
        List<String> roles = user.getUserRoles().stream()
                .filter(UserRole::getActive)
                .map(ur -> ur.getRole().getName())
                .collect(Collectors.toList());

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

    private String generarUsername(String fn, String mn, String ln) {
        String[] partes = ln.split(" ");

        // Protege contra middleName null o vacío
        char segundaInicial = (mn != null && !mn.isEmpty()) ? mn.charAt(0) : fn.charAt(1);

        // Protege contra lastName con una sola palabra
        String username = "" + fn.charAt(0) + segundaInicial + partes[0];
        if (partes.length > 1) {
            username += partes[1].charAt(0);
        }

        if (userRepository.findByUsername(username).isPresent()) {
            // Username exists, append a number to make it unique
            int counter = 1;
            String newUsername = username + counter;
            while (userRepository.findByUsername(newUsername).isPresent()) {
                counter++;
                newUsername = username + counter;
            }
            username = newUsername;
        }

        return username.toLowerCase();
    }


    }
