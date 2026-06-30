import { IsString, IsNumber, Matches, Min, IsInt, IsNotEmpty, Max, MaxLength, MinLength, IsEnum, IsIn, ValidateNested } from 'class-validator';
import { TipoMotocicleta } from '../entities/motocicleta.entity';
import { Type } from 'class-transformer';   
import { Clasificacion } from '../entities/vehiculo.entity';

export class ResponseVehiculoDto {
    id!: number;
    placa?: string;
    marca!: string;
    modelo!: string;
    color!: string
    anio!: number;
    tipo!: string

    clasificacion!: string;
    numeroPuertas?: number;
    capacidadMaletero?: number;
    cabina!: string;
    capacidadCarga?: number;
    tipoMotocicleta?: string;


 

    //trabajr con el patron llamado factory 
    
}