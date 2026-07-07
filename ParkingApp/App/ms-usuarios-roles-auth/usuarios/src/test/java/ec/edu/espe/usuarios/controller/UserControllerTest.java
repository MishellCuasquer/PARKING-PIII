package ec.edu.espe.usuarios.controller;

import ec.edu.espe.usuarios.dto.request.UserCreateRequest;
import ec.edu.espe.usuarios.dto.response.UserResponse;
import ec.edu.espe.usuarios.services.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @Test
    void getAllUsers_devuelveLaListaDelServicio() {
        when(userService.getUsers()).thenReturn(List.of(UserResponse.builder().username("jperez").build()));

        ResponseEntity<List<UserResponse>> response = userController.getAllUsers();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).hasSize(1);
    }

    @Test
    void createUser_devuelve201ConElUsuarioCreado() {
        UserResponse creado = UserResponse.builder().username("jperez").build();
        when(userService.createUser(any())).thenReturn(creado);

        ResponseEntity<UserResponse> response = userController.createUser(new UserCreateRequest());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().getUsername()).isEqualTo("jperez");
    }

    @Test
    void assignRoleToUser_delegaEnElServicio() {
        UUID userId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UserResponse actualizado = UserResponse.builder().username("jperez").build();
        when(userService.assignRole(userId, roleId)).thenReturn(actualizado);

        ResponseEntity<UserResponse> response = userController.assignRoleToUser(userId, roleId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getUsername()).isEqualTo("jperez");
    }
}
