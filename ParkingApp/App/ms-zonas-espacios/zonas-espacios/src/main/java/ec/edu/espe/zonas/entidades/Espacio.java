package ec.edu.espe.zonas.entidades;


import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor

public class Espacio {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)

    private UUID id;

    // Aumentado a 30 para permitir códigos más largos como ZON-VIP-01-001
    @Column(nullable = false, length = 30)
    private String nombre; // zon-vip-01-001

    @Column
    private String descripcion;


    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoEspacio tipo;

    @Column
    private boolean activo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_zona")
    private Zona zona;

    // Copia del tenant de la zona para poder filtrar sin join
    @Column(name = "id_tenant")
    private UUID idTenant;

    @Enumerated(EnumType.STRING)
    @Column(name ="estado")
    private EstadoEspacio estado;

    @Column
    private LocalDateTime fechaCreacion;

    @Column
    private LocalDateTime fechaActualizacion;



}
