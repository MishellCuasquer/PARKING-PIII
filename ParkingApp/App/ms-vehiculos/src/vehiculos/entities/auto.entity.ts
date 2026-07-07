import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

@ChildEntity('Auto')
export class Auto extends Vehiculo {
    @Column()
    numeroPuertas!: number;

    @Column ()
    CapacidadMaletero!: number;

    
    obtenerTipo(): string {
        return 'Auto';
                }

    

    }