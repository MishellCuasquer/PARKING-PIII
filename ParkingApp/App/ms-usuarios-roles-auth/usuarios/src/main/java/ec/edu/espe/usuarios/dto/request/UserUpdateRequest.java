package ec.edu.espe.usuarios.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class UserUpdateRequest {

    @NotBlank(message = "Firstname is required")
    @Size(max = 25, message = "Firstname must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z]+$", message = "Firstname must contain only letters")
    private String firstName;

    private String middleName;

    @NotBlank(message = "Lastname is required")
    @Size(max = 25, message = "Lastname must be at most 25 characters")
    @Pattern(regexp = "^[a-zA-Z]+$", message = "Lastname must contain only letters")
    private String lastName;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Size(max = 100, message = "Email must be at most 100 characters")
    private String email;

    @Pattern(regexp = "^[0-9]+$", message = "Phone must contain only digits")
    private String phone;

    private String address;
    private String nationality;
}
