import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsInt,
  Matches,
  MaxLength,
} from 'class-validator';
import { Clasificacion } from '../entities/vehiculo.entity';

/**
 * Los campos son opcionales, pero los que lleguen se validan con las MISMAS
 * reglas que en el alta. Antes solo se exigía que fueran texto, así que una
 * edición podía dejar en la base de datos un color con números que el alta
 * habría rechazado.
 */
export class UpdateVehiculoDto {
  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15, { message: 'La marca no puede tener más de 15 caracteres' })
  @Matches(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/, {
    message: 'La marca solo puede contener letras y espacios',
  })
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El modelo no puede tener más de 20 caracteres' })
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\s.-]*$/, {
    message: 'El modelo admite letras, números, espacios, puntos y guiones',
  })
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'El color no puede tener más de 20 caracteres' })
  @Matches(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/, {
    message: 'El color solo puede contener letras y espacios',
  })
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
