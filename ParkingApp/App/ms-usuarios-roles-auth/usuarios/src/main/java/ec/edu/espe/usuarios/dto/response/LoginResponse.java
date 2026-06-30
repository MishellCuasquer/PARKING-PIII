package ec.edu.espe.usuarios.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponse {

    private String token;
    private final String type = "Bearer";
    private Long expiresIn;
    private String userId;
    private String username;
    private List<String> roles;
}
