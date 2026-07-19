package ec.edu.espe.zonas.entidades;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Builder
@Entity
// nombre y codigo son únicos por tenant: dos empresas pueden tener "Zona VIP" cada una
@Table(uniqueConstraints = {
        @UniqueConstraint(name = "uk_zona_nombre_tenant", columnNames = {"nombre", "id_tenant"}),
        @UniqueConstraint(name = "uk_zona_codigo_tenant", columnNames = {"codigo", "id_tenant"})
})
@Data
//@Builder
@NoArgsConstructor
@AllArgsConstructor


public class Zona {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)

    private UUID id;

    @Column(nullable = false, length = 25)
    private String nombre;

    @Column(nullable = false, length = 11)
    private String codigo;  //ZON-VIP-01, ZON-VIP-02, ZON-VIS-01

    // Empresa/parqueadero dueño de la zona; null solo en datos previos al multitenant
    @Column(name = "id_tenant")
    private UUID idTenant;



    @Column(nullable = true)
    private String descripcion;

    @Column(nullable = true)
    private int capacidad;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoZona tipo;

    @Column
    private boolean activo;


    @OneToMany(mappedBy = "zona",
            cascade = CascadeType.ALL,
            orphanRemoval = true)
    private List<Espacio> espacios;

    @Column
    private LocalDateTime fechaCreacion;

    @Column
    private LocalDateTime fechaActualizacion;





}