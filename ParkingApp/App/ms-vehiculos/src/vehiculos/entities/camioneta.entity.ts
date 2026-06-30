import { ChildEntity } from "typeorm";
import { Vehiculo } from "./vehiculo.entity";
import { Column } from "typeorm";


@ChildEntity('Camioneta')
export class Camioneta extends Vehiculo {
     @Column()
    cabina!: string;

    @Column('decimal', { precision: 10, scale: 2 })
    capacidadCarga!: number;

    obtenerTipo(): string {
        return 'Camioneta';

         }


    
    
}
   


