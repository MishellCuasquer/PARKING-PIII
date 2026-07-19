import { IsEnum } from 'class-validator';
import {Column, Entity, Index, PrimaryGeneratedColumn, TableInheritance} from 'typeorm';

export enum Clasificacion{
    DIESEL = 'Diesel',
    GASOLINA = 'Gasolina',
    ELECTRICO = 'Eléctrico',
    HIBRIDO = 'Híbrido'
    
}
@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'tipo' } })
// La placa es única por tenant: la misma placa puede registrarse en dos parqueaderos
@Index('UQ_vehiculo_tenant_placa', ['tenantId', 'placa'], { unique: true })
export abstract class Vehiculo {

    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    placa!: string;

    // Empresa/parqueadero dueño del registro; null solo en datos previos al multitenant
    @Column({ type: 'uuid', nullable: true })
    tenantId?: string | null;

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