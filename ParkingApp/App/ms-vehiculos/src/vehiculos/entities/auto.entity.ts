import { ChildEntity, Column } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";

@ChildEntity('Auto')
export class Auto extends Vehiculo {
    @Column()
    numeroPuertas!: number;

    @Column ()
    CpacidadMaletero!: number;

    
    obtenerTipo(): string {
        return 'Auto';
                }

    

    }