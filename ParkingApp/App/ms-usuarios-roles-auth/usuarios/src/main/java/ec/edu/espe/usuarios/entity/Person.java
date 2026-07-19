package ec.edu.espe.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
// Unicidad de dni/email/phone por tenant: la misma persona puede existir en dos parqueaderos distintos
@Table(name = "person", uniqueConstraints = {
        @UniqueConstraint(name = "uk_person_dni_tenant", columnNames = {"dni", "id_tenant"}),
        @UniqueConstraint(name = "uk_person_email_tenant", columnNames = {"email", "id_tenant"}),
        @UniqueConstraint(name = "uk_person_phone_tenant", columnNames = {"phone", "id_tenant"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor

public class Person {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(nullable = false, length = 25)
    private String dni;

    @Column(nullable = false, length = 25)
    private String firstName;

    @Builder.Default
    @Column(nullable = false, length = 25)
    private String middleName ="";

    @Column(nullable = false, length = 25)
    private String lastName;

    @Column(nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 15)
    private String phone;

    // Nullable: superadmin y la cuenta service no pertenecen a ningún tenant
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_tenant")
    private Tenant tenant;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(nullable = false, length = 25)
    private String nationality;

    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}