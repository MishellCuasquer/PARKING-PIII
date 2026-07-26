package ec.edu.espe.usuarios.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "tenants")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Tenant {

    // Id asignable (sin @GeneratedValue) para poder sembrar el tenant default con UUID fijo
    @Id
    private UUID id;

    @Column(nullable = false, length = 100, unique = true)
    private String nombre;

    @Column(nullable = false, length = 20, unique = true)
    private String codigo;

    @Builder.Default
    @Column(nullable = false)
    private Boolean activo = true;

    // --- Configuración propia de cada empresa (modelo SaaS) ---
    // Todas las columnas son NULLABLE a propósito: con ddl-auto=update, las
    // filas que ya existían quedan a NULL y Hibernate fallaría al añadir una
    // columna NOT NULL sobre una tabla con datos. El valor por defecto se
    // aplica en la capa de servicio (ver TenantServiceImpl.toResponse).

    /** Precio por hora de parqueo. Cada empresa fija el suyo. */
    @Column(name = "tarifa_hora", precision = 10, scale = 2)
    private BigDecimal tarifaHora;

    /** Moneda en la que se cobra la tarifa (código ISO-4217, p. ej. USD). */
    @Column(name = "moneda", length = 3)
    private String moneda;

    /** Hora a la que abre el parqueadero. */
    @Column(name = "hora_apertura")
    private LocalTime horaApertura;

    /** Hora a la que cierra el parqueadero. */
    @Column(name = "hora_cierre")
    private LocalTime horaCierre;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        createdAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
