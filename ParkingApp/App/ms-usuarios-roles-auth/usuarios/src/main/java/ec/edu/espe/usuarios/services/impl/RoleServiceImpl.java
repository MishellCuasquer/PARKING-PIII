package ec.edu.espe.usuarios.services.impl;

import ec.edu.espe.usuarios.dto.request.RoleCreateRequest;
import ec.edu.espe.usuarios.dto.response.RoleResponse;
import ec.edu.espe.usuarios.entity.Role;
import ec.edu.espe.usuarios.repository.RoleRepository;
import ec.edu.espe.usuarios.services.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final RoleRepository roleRepository;

    @Override
    public RoleResponse createRole(RoleCreateRequest roleRequest) {

        // Validación de unicidad
        if (roleRepository.existsByName(roleRequest.getName())) {
            throw new IllegalArgumentException("El nombre del rol ya existe");
        }

        // Creación del Role
        Role role = Role.builder()
                .name(roleRequest.getName())
                .description(roleRequest.getDescription())
                .active(true)
                .build();

        role = roleRepository.save(role);

        return mapToRoleResponse(role);
    }


    @Override
    public List<RoleResponse> getRoles() {
        return roleRepository.findAll()
                .stream()
                .map(this::mapToRoleResponse)
                .collect(Collectors.toList());
    }

    @Override
    public RoleResponse getRoleById(UUID id) {
        return null;
    }

    // Método privado helper para mapear Role -> RoleResponse
    private RoleResponse mapToRoleResponse(Role role) {
        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .active(role.isActive())
                .createdAt(role.getCreatedAt())
                .updatedAt(role.getUpdatedAt())
                .build();
    }
}