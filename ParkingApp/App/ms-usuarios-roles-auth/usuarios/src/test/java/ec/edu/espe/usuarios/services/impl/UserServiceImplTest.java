package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.entity.Person;
import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.entity.User;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private PersonRepository personRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuditPublisher auditPublisher;

    @InjectMocks
    private UserServiceImpl userService;

    private Role clientRole;
    private Person person;
    private User user;

    @BeforeEach
    void setUp() {
        clientRole = Role.builder().id(UUID.randomUUID()).name("CLIENT").build();
        person = Person.builder()
                .id(UUID.randomUUID())
                .dni("1111111111")
                .firstName("Juan")
                .lastName("Perez")
                .email("juan@test.com")
                .phone("0999999999")
                .build();
        user = User.builder()
                .id(person.getId())
                .person(person)
                .username("jpperez")
                .passwordHash("hash")
                .active(true)
                .role(clientRole)
                .build();
    }

    @Test
    void createUser_creaUsuarioConRolClienteYPublicaAuditoria() {
        UserCreateRequest request = new UserCreateRequest();
        request.setDni("1111111111");
        request.setFirstName("Juan");
        request.setLastName("Perez");
        request.setEmail("juan@test.com");
        request.setPhone("0999999999");

        when(personRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(personRepository.existsByDni(request.getDni())).thenReturn(false);
        when(personRepository.save(any(Person.class))).thenReturn(person);
        when(roleRepository.findByName("CLIENT")).thenReturn(Optional.of(clientRole));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(user);

        UserResponse response = userService.createUser(request);

        assertThat(response.getUsername()).isEqualTo("jpperez");
        verify(auditPublisher).publish(org.mockito.ArgumentMatchers.eq("CREATE"), org.mockito.ArgumentMatchers.eq("User"), anyMap());
    }

    @Test
    void createUser_generaUsernameConMiddleNameApellidoCompuestoYResuelveColision() {
        UserCreateRequest request = new UserCreateRequest();
        request.setDni("2222222222");
        request.setFirstName("Juan");
        request.setMiddleName("Carlos");
        request.setLastName("Perez Ruiz");
        request.setEmail("juan2@test.com");
        request.setPhone("0988888888");

        when(personRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(personRepository.existsByDni(request.getDni())).thenReturn(false);
        when(personRepository.save(any(Person.class))).thenReturn(person);
        when(roleRepository.findByName("CLIENT")).thenReturn(Optional.of(clientRole));
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        // Primer username generado ya existe; el segundo (con contador) esta libre.
        // La comparacion de colision usa el username antes de aplicar toLowerCase().
        when(userRepository.findByUsernameWithRole("JCPerezR")).thenReturn(Optional.of(user));
        when(userRepository.findByUsernameWithRole("JCPerezR1")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            return User.builder().id(person.getId()).person(person).username(u.getUsername())
                    .active(true).role(clientRole).build();
        });

        UserResponse response = userService.createUser(request);

        assertThat(response.getUsername()).isEqualTo("jcperezr1");
    }

    @Test
    void createUser_lanzaExcepcionSiElEmailYaExiste() {
        UserCreateRequest request = new UserCreateRequest();
        request.setEmail("juan@test.com");
        request.setDni("1111111111");

        when(personRepository.existsByEmail(request.getEmail())).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("email");
    }

    @Test
    void createUser_lanzaExcepcionSiElDniYaExiste() {
        UserCreateRequest request = new UserCreateRequest();
        request.setEmail("nuevo@test.com");
        request.setDni("1111111111");

        when(personRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(personRepository.existsByDni(request.getDni())).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("DNI");
    }

    @Test
    void getUsers_devuelveListaMapeada() {
        when(userRepository.findAll()).thenReturn(java.util.List.of(user));

        var result = userService.getUsers();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUsername()).isEqualTo("jpperez");
    }

    @Test
    void getUserById_devuelveUsuarioCuandoExiste() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        UserResponse response = userService.getUserById(user.getId());

        assertThat(response.getId()).isEqualTo(user.getId());
    }

    @Test
    void getUserById_lanzaExcepcionCuandoNoExiste() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(id))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignRole_asignaNuevoRolYPublicaAuditoria() {
        Role adminRole = Role.builder().id(UUID.randomUUID()).name("ADMIN").build();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(roleRepository.findById(adminRole.getId())).thenReturn(Optional.of(adminRole));
        when(userRepository.save(any(User.class))).thenReturn(user);

        UserResponse response = userService.assignRole(user.getId(), adminRole.getId());

        assertThat(response.getRoles()).contains("ADMIN");
        verify(auditPublisher).publish(org.mockito.ArgumentMatchers.eq("UPDATE"), org.mockito.ArgumentMatchers.eq("User"), anyMap());
    }

    @Test
    void assignRole_lanzaConflictoSiYaTieneEseRol() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(roleRepository.findById(clientRole.getId())).thenReturn(Optional.of(clientRole));

        assertThatThrownBy(() -> userService.assignRole(user.getId(), clientRole.getId()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void assignRole_lanzaNotFoundSiUsuarioNoExiste() {
        UUID id = UUID.randomUUID();
        when(userRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.assignRole(id, clientRole.getId()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void updateUser_actualizaDatosDePersona() {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setFirstName("Juan Carlos");
        request.setLastName("Perez");
        request.setEmail("juan@test.com");
        request.setPhone("0999999999");

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(personRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(person));
        when(personRepository.findByPhone(request.getPhone())).thenReturn(Optional.of(person));
        when(personRepository.save(any(Person.class))).thenReturn(person);

        UserResponse response = userService.updateUser(user.getId(), request);

        assertThat(response.getUsername()).isEqualTo("jpperez");
        verify(auditPublisher).publish(org.mockito.ArgumentMatchers.eq("UPDATE"), org.mockito.ArgumentMatchers.eq("User"), anyMap());
    }

    @Test
    void updateUser_lanzaConflictoSiElEmailPerteneceAOtraPersona() {
        UserUpdateRequest request = new UserUpdateRequest();
        request.setEmail("otro@test.com");

        Person otraPersona = Person.builder().id(UUID.randomUUID()).build();

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(personRepository.findByEmail(request.getEmail())).thenReturn(Optional.of(otraPersona));

        assertThatThrownBy(() -> userService.updateUser(user.getId(), request))
                .isInstanceOf(ResponseStatusException.class);
    }
}
