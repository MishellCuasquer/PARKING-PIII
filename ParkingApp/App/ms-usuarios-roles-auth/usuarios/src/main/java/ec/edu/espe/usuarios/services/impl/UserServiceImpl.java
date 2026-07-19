package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.audit.AuditPublisher;
import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.PersonResponse;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.entity.*;
import ec.edu.espe.usuarios.repository.PersonRepository;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.repository.TenantRepository;
import ec.edu.espe.usuarios.repository.UserRepository;
import ec.edu.espe.usuarios.security.CallerContext;
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
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditPublisher auditPublisher;
    private final CallerContext callerContext;

    @Override
    public UserResponse createUser(UserCreateRequest userRequest) {

        Tenant tenant = resolveTenantForNewUser(userRequest.getTenantId());

        // Validaciones de unicidad dentro del tenant
        if (personRepository.existsByEmailAndTenant_Id(userRequest.getEmail(), tenant.getId())) {
            throw new IllegalArgumentException("El email ya existe");
        }
        if (personRepository.existsByDniAndTenant_Id(userRequest.getDni(), tenant.getId())) {
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
                .tenant(tenant)
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
        ), savedUser.getUsername(), tenant.getId().toString());

        return mapToUserResponse(savedUser);
    }

    @Override
    @Transactional (readOnly = true)
    public List<UserResponse> getUsers() {

        // ADMIN de empresa solo ve su tenant; SUPER_ADMIN (sin tenant) ve todos
        UUID callerTenantId = callerTenantId();
        List<User> users = callerTenantId != null
                ? userRepository.findByPerson_Tenant_Id(callerTenantId)
                : userRepository.findAll();

        return users.stream()
                .map(this::mapToUserResponse)
                .collect(Collectors.toList()
        );
    }

    @Override
    @Transactional(readOnly = true)
        public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado con ID: " + id));
        assertSameTenantAsCaller(user);
        return mapToUserResponse(user);
    }

    // Asigna un rol a un usuario, reemplazando el rol anterior (un usuario = un solo rol activo)
    @Override
    public UserResponse assignRole(UUID userId, UUID roleId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        assertSameTenantAsCaller(user);

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


    // Elimina el usuario y su persona asociada. El admin semilla no se puede borrar.
    @Override
    public void deleteUser(UUID userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        assertSameTenantAsCaller(user);

        if ("admin".equals(user.getUsername()) || "superadmin".equals(user.getUsername())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "No se puede eliminar la cuenta admin del sistema");
        }

        Person person = user.getPerson();
        userRepository.delete(user);
        if (person != null) {
            personRepository.delete(person);
        }

        auditPublisher.publish("DELETE", "User", Map.of(
                "id", userId,
                CAMPO_USERNAME, user.getUsername()
        ));
    }

    @Override
    public UserResponse updateUser(UUID userId, UserUpdateRequest userRequest) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Usuario no encontrado"));
        assertSameTenantAsCaller(user);

        Person person = user.getPerson();
        UUID tenantId = person.getTenant() != null ? person.getTenant().getId() : null;

        // Unicidad por tenant (cuentas sin tenant validan global)
        var emailOwner = tenantId != null
                ? personRepository.findByEmailAndTenant_Id(userRequest.getEmail(), tenantId)
                : personRepository.findByEmail(userRequest.getEmail());
        emailOwner
                .filter(existing -> !existing.getId().equals(person.getId()))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "El email ya está en uso");
                });

        if (userRequest.getPhone() != null && !userRequest.getPhone().isBlank()) {
            var phoneOwner = tenantId != null
                    ? personRepository.findByPhoneAndTenant_Id(userRequest.getPhone(), tenantId)
                    : personRepository.findByPhone(userRequest.getPhone());
            phoneOwner
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

        Tenant tenant = person.getTenant();

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .active(user.getActive())
                .lastLogin(user.getLastLogin())
                .createdAt(user.getCreatedAt())
                .person(personResponse)
                .roles(roles)
                .tenantId(tenant != null ? tenant.getId() : null)
                .tenantNombre(tenant != null ? tenant.getNombre() : null)
                .build();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /**
     * Resuelve el tenant de un usuario nuevo:
     * - Si el request trae tenantId, debe existir y estar activo.
     * - Si no lo trae y el caller (ADMIN de empresa) tiene tenant, hereda el del caller.
     * - Registro anónimo sin tenantId → 400 (el selector del frontend siempre lo envía).
     */
    private Tenant resolveTenantForNewUser(String requestTenantId) {
        if (requestTenantId != null && !requestTenantId.isBlank()) {
            UUID tenantId;
            try {
                tenantId = UUID.fromString(requestTenantId);
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tenantId inválido");
            }
            Tenant tenant = tenantRepository.findById(tenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tenant no existe"));
            if (Boolean.FALSE.equals(tenant.getActivo())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tenant no está activo");
            }
            return tenant;
        }

        UUID callerTenantId = callerTenantId();
        if (callerTenantId != null) {
            return tenantRepository.findById(callerTenantId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tenant del solicitante no existe"));
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Debe indicar la empresa (tenantId) a la que se registra el usuario");
    }

    // Tenant del usuario autenticado; null si es anónimo o una cuenta global (superadmin/service)
    private UUID callerTenantId() {
        return callerContext.callerTenantId();
    }

    // Aislamiento: un ADMIN de empresa no puede operar sobre usuarios de otro tenant (404 para no filtrar existencia)
    private void assertSameTenantAsCaller(User target) {
        UUID callerTenantId = callerTenantId();
        if (callerTenantId == null) {
            return; // SUPER_ADMIN u otra cuenta global: acceso total
        }
        UUID targetTenantId = target.getPerson() != null && target.getPerson().getTenant() != null
                ? target.getPerson().getTenant().getId()
                : null;
        if (!callerTenantId.equals(targetTenantId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuario no encontrado");
        }
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
