package ec.edu.espe.usuarios.services;

import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.request.UserUpdateRequest;
import ec.edu.espe.usuarios.dto.response.UserResponse;

import java.util.List;
import java.util.UUID;

public interface UserService {

    UserResponse createUser(UserCreateRequest userRequest);

    List<UserResponse> getUsers();

    UserResponse getUserById(UUID id);

    UserResponse assignRole(UUID id, UUID roleId);

    UserResponse updateUser(UUID id, UserUpdateRequest userRequest);

    void deleteUser(UUID id);

}