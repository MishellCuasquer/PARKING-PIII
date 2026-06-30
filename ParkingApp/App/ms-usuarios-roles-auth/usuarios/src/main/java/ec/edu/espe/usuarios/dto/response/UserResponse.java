package ec.edu.espe.usuarios.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;

@Data
@Builder
public class UserResponse {

    private UUID id;
    private String username;
    private Boolean active;
    private LocalDateTime lastLogin;
    private LocalDateTime createdAt;
    private PersonResponse person;
    private List<String> roles;

}