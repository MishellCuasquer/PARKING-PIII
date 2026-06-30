package ec.edu.espe.usuarios.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class RoleCreateRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 25, message = "Name must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z ]+$", message = "El nombre debe contener solo letras.")
    private String name;

    private String description;
}