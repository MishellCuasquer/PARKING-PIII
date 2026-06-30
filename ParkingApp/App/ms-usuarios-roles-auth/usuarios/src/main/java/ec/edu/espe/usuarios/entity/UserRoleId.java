package ec.edu.espe.usuarios.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Id;
import lombok.*;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode
public class UserRoleId  implements Serializable {

    @Column(name = "id_user")
    private UUID idUser;

    @Column(name = "id_role")
    private UUID idRole;
}

