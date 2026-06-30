package ec.edu.espe.usuarios.services;

import ec.edu.espe.usuarios.dto.request.RoleCreateRequest;
import ec.edu.espe.usuarios.dto.response.RoleResponse;

import java.util.List;
import java.util.UUID;

public interface RoleService {

    RoleResponse createRole(RoleCreateRequest roleRequest);

    List<RoleResponse> getRoles();

    RoleResponse getRoleById(UUID id);
}