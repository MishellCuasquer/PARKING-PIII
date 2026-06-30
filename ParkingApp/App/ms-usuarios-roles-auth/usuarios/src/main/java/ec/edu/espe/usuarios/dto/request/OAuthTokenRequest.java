package ec.edu.espe.usuarios.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OAuthTokenRequest {

    @NotBlank(message = "grant_type is required")
    @JsonProperty("grant_type")
    private String grantType;

    private String username;

    private String password;
}
