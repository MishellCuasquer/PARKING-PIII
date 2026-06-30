import { Vehiculo } from './vehiculo.entity';
import { ChildEntity, Column } from 'typeorm';


export enum TipoMotocicleta {
    DEPORTIVA = 'Deportiva',
}


@ChildEntity('Motocicleta')
export class Motocicleta extends Vehiculo {
    @Column()
    tipo!: TipoMotocicleta;

    obtenerTipo(): string {
        return 'Moto';

    }

 }