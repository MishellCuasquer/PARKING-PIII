package ec.edu.espe.usuarios.dto.request;

import lombok.Data;
import jakarta.validation.constraints.*;

@Data
public class UserCreateRequest {

    /**
     * Patron de nombres y apellidos: admite espacios, tildes y ñ.
     *
     * <p>El patron anterior era {@code ^[a-zA-Z]+$}, que rechazaba "Cuasquer
     * Chisaguano" (dos apellidos, lo habitual aqui) y cualquier nombre con
     * tilde. Se aceptan tambien apostrofo y guion por los apellidos compuestos
     * tipo "D'Angelo" o "Perez-Lara". Los separadores no pueden ir al principio,
     * al final, ni repetidos.</p>
     */
    public static final String PATRON_NOMBRE =
            "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$";
    public static final String MENSAJE_NOMBRE =
            "solo admite letras, espacios, apóstrofo y guion";

    @NotBlank(message = "La cédula es obligatoria")
    @Size(max = 10, message = "La cédula debe tener como máximo 10 caracteres")
    @Pattern(regexp = "^[0-9]+$", message = "La cédula solo puede contener dígitos")
    private String dni;

    @NotBlank(message = "El primer nombre es obligatorio")
    @Size(max = 40, message = "El primer nombre debe tener como máximo 40 caracteres")
    @Pattern(regexp = PATRON_NOMBRE, message = "El primer nombre " + MENSAJE_NOMBRE)
    private String firstName;

    // Opcional: el patron admite tambien la cadena vacia.
    @Size(max = 40, message = "El segundo nombre debe tener como máximo 40 caracteres")
    @Pattern(regexp = "^$|" + PATRON_NOMBRE, message = "El segundo nombre " + MENSAJE_NOMBRE)
    private String middleName;

    @NotBlank(message = "Los apellidos son obligatorios")
    @Size(max = 60, message = "Los apellidos deben tener como máximo 60 caracteres")
    @Pattern(regexp = PATRON_NOMBRE, message = "Los apellidos " + MENSAJE_NOMBRE)
    private String lastName;

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El formato del email no es válido")
    @Size(max = 100, message = "El email debe tener como máximo 100 caracteres")
    private String email;

    @Pattern(regexp = "^[0-9]+$", message = "El teléfono solo puede contener dígitos")
    private String phone;

    private String address;

    // La nacionalidad es texto ("Ecuatoriana", "Peruana"), nunca una cifra.
    // Antes no tenia ninguna validacion y el formulario aceptaba numeros.
    @Size(max = 40, message = "La nacionalidad debe tener como máximo 40 caracteres")
    @Pattern(regexp = "^$|" + PATRON_NOMBRE, message = "La nacionalidad " + MENSAJE_NOMBRE)
    private String nationality;

    // Tenant al que se registra el usuario; obligatorio en registro anónimo
    private String tenantId;
}
