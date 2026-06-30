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
@Table
@Data
//@Builder
@NoArgsConstructor
@AllArgsConstructor


public class Zona {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)

    private UUID id;

    @Column(nullable = false, unique = true, length = 25)
    private String nombre;

    @Column(nullable = false, unique = true, length = 11)
    private String codigo;  //ZON-VIP-01, ZON-VIP-02, ZON-VIS-01



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