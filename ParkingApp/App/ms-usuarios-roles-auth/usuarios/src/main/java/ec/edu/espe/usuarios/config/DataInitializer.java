package ec.edu.espe.usuarios.config;

import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private static final String USERNAME_ADMIN = "admin";
    private static final String USERNAME_OPERADOR = "operador";
    private static final String USERNAME_SERVICE = "service";

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PersonRepository personRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        Role adminRole = ensureRole("ADMIN", "Administrador del sistema");
        Role operatorRole = ensureRole("OPERATOR", "Operador del parqueadero");
        Role clientRole = ensureRole("CLIENT", "Cliente del parqueadero");
        Role serviceRole = ensureRole("SERVICE", "Cuenta de servicio entre microservicios");

        if (!userRepository.existsByUsername(USERNAME_ADMIN)) {
            Person person = Person.builder()
                    .dni("0000000000")
                    .firstName("Admin")
                    .lastName("Sistema")
                    .email("admin@parking.local")
                    .phone("0000000000")
                    .nationality("EC")
                    .build();
            person = personRepository.save(person);

            User admin = User.builder()
                    .person(person)
                    .username(USERNAME_ADMIN)
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .active(true)
                    .role(adminRole)
                    .build();
            userRepository.save(admin);
        }

        if (!userRepository.existsByUsername(USERNAME_OPERADOR)) {
            Person operatorPerson = Person.builder()
                    .dni("2222222222")
                    .firstName("Operador")
                    .lastName("Demo")
                    .email("operador@parking.local")
                    .phone("2222222222")
                    .nationality("EC")
                    .build();
            operatorPerson = personRepository.save(operatorPerson);

            User operatorUser = User.builder()
                    .person(operatorPerson)
                    .username(USERNAME_OPERADOR)
                    .passwordHash(passwordEncoder.encode("operador123"))
                    .active(true)
                    .role(operatorRole)
                    .build();
            userRepository.save(operatorUser);
        }

        if (!userRepository.existsByUsername(USERNAME_SERVICE)) {
            Person servicePerson = Person.builder()
                    .dni("9999999999")
                    .firstName("Service")
                    .lastName("Account")
                    .email("service@parking.local")
                    .phone("9999999999")
                    .nationality("EC")
                    .build();
            servicePerson = personRepository.save(servicePerson);

            User serviceUser = User.builder()
                    .person(servicePerson)
                    .username(USERNAME_SERVICE)
                    .passwordHash(passwordEncoder.encode("service123"))
                    .active(true)
                    .role(serviceRole)
                    .build();
            userRepository.save(serviceUser);
        }

        if (!userRepository.existsByUsername("cliente")) {
            Person clientPerson = Person.builder()
                    .dni("1111111111")
                    .firstName("Cliente")
                    .lastName("Demo")
                    .email("cliente@parking.local")
                    .phone("1111111111")
                    .nationality("EC")
                    .build();
            clientPerson = personRepository.save(clientPerson);

            User clientUser = User.builder()
                    .person(clientPerson)
                    .username("cliente")
                    .passwordHash(passwordEncoder.encode("cliente123"))
                    .active(true)
                    .role(clientRole)
                    .build();
            userRepository.save(clientUser);
        }

        migrarContrasenasSinHashear();
        backfillRolesForExistingUsers(adminRole, operatorRole, clientRole, serviceRole);
    }

    // Usuarios de una BD previa a la columna role_id quedan con role=null tras ddl-auto=update; se resuelven aquí.
    private void backfillRolesForExistingUsers(Role adminRole, Role operatorRole, Role clientRole, Role serviceRole) {
        userRepository.findAll().forEach(user -> {
            if (user.getRole() != null) {
                return;
            }
            switch (user.getUsername()) {
                case USERNAME_ADMIN -> user.setRole(adminRole);
                case USERNAME_OPERADOR -> user.setRole(operatorRole);
                case USERNAME_SERVICE -> user.setRole(serviceRole);
                default -> user.setRole(clientRole);
            }
            userRepository.save(user);
        });
    }

    private void migrarContrasenasSinHashear() {
        userRepository.findAll().forEach(user -> {
            String stored = user.getPasswordHash();
            if (stored != null && !stored.startsWith("$2")) {
                user.setPasswordHash(passwordEncoder.encode(stored));
                userRepository.save(user);
            }
        });
    }

    private Role ensureRole(String name, String description) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(
                        Role.builder().name(name).description(description).active(true).build()
                ));
    }
}