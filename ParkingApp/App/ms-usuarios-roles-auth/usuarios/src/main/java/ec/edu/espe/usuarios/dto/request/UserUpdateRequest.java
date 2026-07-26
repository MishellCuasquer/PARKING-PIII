package ec.edu.espe.usuarios.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

/**
 * Datos editables de un usuario ya creado. La cedula no esta: identifica a la
 * persona y cambiarla seria convertirla en otra distinta.
 *
 * <p>Las reglas de formato son las mismas que en el alta
 * ({@link UserCreateRequest#PATRON_NOMBRE}). Si el alta acepta "Cuasquer
 * Chisaguano", la edicion tiene que aceptarlo tambien; de lo contrario
 * corregir una errata en el apellido resultaria imposible.</p>
 */
@Data
public class UserUpdateRequest {

    @NotBlank(message = "El primer nombre es obligatorio")
    @Size(max = 40, message = "El primer nombre debe tener como máximo 40 caracteres")
    @Pattern(regexp = UserCreateRequest.PATRON_NOMBRE,
            message = "El primer nombre " + UserCreateRequest.MENSAJE_NOMBRE)
    private String firstName;

    @Size(max = 40, message = "El segundo nombre debe tener como máximo 40 caracteres")
    @Pattern(regexp = "^$|" + UserCreateRequest.PATRON_NOMBRE,
            message = "El segundo nombre " + UserCreateRequest.MENSAJE_NOMBRE)
    private String middleName;

    @NotBlank(message = "Los apellidos son obligatorios")
    @Size(max = 60, message = "Los apellidos deben tener como máximo 60 caracteres")
    @Pattern(regexp = UserCreateRequest.PATRON_NOMBRE,
            message = "Los apellidos " + UserCreateRequest.MENSAJE_NOMBRE)
    private String lastName;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El formato del email no es válido")
    @Size(max = 100, message = "El email debe tener como máximo 100 caracteres")
    private String email;

    @Pattern(regexp = "^[0-9]+$", message = "El teléfono solo puede contener dígitos")
    private String phone;

    private String address;

    @Size(max = 40, message = "La nacionalidad debe tener como máximo 40 caracteres")
    @Pattern(regexp = "^$|" + UserCreateRequest.PATRON_NOMBRE,
            message = "La nacionalidad " + UserCreateRequest.MENSAJE_NOMBRE)
    private String nationality;
}
