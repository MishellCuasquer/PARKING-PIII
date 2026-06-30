import { IsEnum } from 'class-validator';
import {Column, Entity, PrimaryGeneratedColumn, TableInheritance} from 'typeorm';

export enum Clasificacion{
    DIESEL = 'Diesel',
    GASOLINA = 'Gasolina',
    ELECTRICO = 'Eléctrico',
    HIBRIDO = 'Híbrido'
    
}
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'tipo' } })
export abstract class Vehiculo {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ unique: true })
    placa!: string;

    @Column()
    marca!: string;

    @Column()
    modelo!: string;

    @Column()
    color!: string;

    @Column()
    anio!: number;

    @Column()
    @IsEnum(Clasificacion)
    clasificacion!: Clasificacion;

    abstract obtenerTipo(): string;
}