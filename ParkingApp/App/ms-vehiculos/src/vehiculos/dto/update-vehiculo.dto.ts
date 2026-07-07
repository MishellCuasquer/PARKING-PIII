import { IsString, IsNumber, IsOptional, IsEnum, Min, Max, IsInt } from 'class-validator';
import { Clasificacion } from '../entities/vehiculo.entity';

export class UpdateVehiculoDto {
  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  marca?: string;

  @IsOptional()
  @IsString()
  modelo?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2027)
  @IsInt()
  anio?: number;

  @IsOptional()
  @IsEnum(Clasificacion)
  clasificacion?: Clasificacion;

  @IsOptional()
  @IsString()
  cabina?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10000)
  capacidadCarga?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(5)
  @IsInt()
  numeroPuertas?: number;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(1000)
  CapacidadMaletero?: number;
}
