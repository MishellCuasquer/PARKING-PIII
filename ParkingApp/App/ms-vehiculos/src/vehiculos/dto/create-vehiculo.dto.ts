   import { IsString, IsNumber, Matches, Min, IsInt, IsNotEmpty, Max, MaxLength, MinLength, IsEnum, IsIn, ValidateNested } from 'class-validator';
import { TipoMotocicleta } from '../entities/motocicleta.entity';
import { Type } from 'class-transformer';
import { Clasificacion } from '../entities/vehiculo.entity';
import { MAX_YEAR } from '../../config/year.config';


   class BaseVehiculoDto {
    @IsString()
    @Matches(/^[A-Z]{3}-\d{4}$/, { message: 'La placa debe tener el formato ABC-1234' })

    placa!: string;

    @IsString()
    @IsNotEmpty({ message: 'La marca no puede estar vacía' })
    @MinLength(2, { message: 'La marca debe tener al menos 2 caracteres' })
    @MaxLength(15, { message: 'La marca no puede tener más de 15 caracteres' })
    @Matches(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/, {
      message: 'La marca solo puede contener letras y espacios',
    })
    marca!: string;

    // El modelo SI admite numeros: "Mazda 3", "Serie 3", "Corolla 2020" o
    // "208" son modelos reales. Antes usaba el mismo patron que la marca y
    // rechazaba cualquier cifra.
    @IsString()
    @IsNotEmpty({ message: 'El modelo no puede estar vacío' })
    @MinLength(1, { message: 'El modelo debe tener al menos 1 caracter' })
    @MaxLength(20, { message: 'El modelo no puede tener más de 20 caracteres' })
    @Matches(/^[A-Za-z0-9][A-Za-z0-9\s.-]*$/, {
      message: 'El modelo admite letras, números, espacios, puntos y guiones',
    })
    modelo!: string;

    // El color es texto: los mensajes decian "marca" porque estaban copiados
    // del campo de arriba, y al fallar el color el usuario leia un error sobre
    // un campo que no habia tocado.
    @IsString()
    @IsNotEmpty({ message: 'El color no puede estar vacío' })
    @MinLength(2, { message: 'El color debe tener al menos 2 caracteres' })
    @MaxLength(20, { message: 'El color no puede tener más de 20 caracteres' })
    @Matches(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/, {
      message: 'El color solo puede contener letras y espacios',
    })
    color!: string;
    @IsNumber()
    @Min(1900, { message: 'El año debe ser mayor o igual a 1900' })
    @Max(MAX_YEAR, { message: `El año no puede ser mayor a ${MAX_YEAR}` })
    @IsInt({ message: 'El año debe ser un número entero' })
    anio!: number;
    @IsEnum(Clasificacion, {
  message: 'La clasificación debe ser Diesel, Gasolina, Eléctrico o Híbrido'
})
clasificacion!: Clasificacion;
    }
    class AutoDto extends BaseVehiculoDto {
    @IsNumber()
    @Min(2, { message: 'El número de puertas debe ser al menos 2' })    
    @Max(5, { message: 'el numero de puertas no puede ser  mayor a 5' })
    @IsInt({ message: 'El número de puertas debe ser un número entero' })
    numeroPuertas!: number;

    @IsNumber()
    @Min(100, {
         message: 'La capacidad del maletero debe ser al menos 100 litros' ,
        })
    @Max(1000, {
         message: 'La capacidad del maletero no puede ser mayor a 1000 litros',
         })
    
    CapacidadMaletero!: number;
    }
    

// crear una variable de entorno que capture el año actual que me decuelva del sistema 
//el año no puede ser maximo al año actual +1
// estamos 2026 mpaximo 2027

class MotoDto extends BaseVehiculoDto {
    @IsString()
    @Matches(/^[A-Z]{2}-\d{4}$/, { message: 'La placa debe tener el formato ABC-1234' })
    declare placa: string;
    @IsNotEmpty({ message: 'El tipo de motocicleta no puede estar vacío' })
    @IsEnum(TipoMotocicleta, { 
        message: 'El tipo de motocicleta debe ser uno de los siguientes: ' + Object.values(TipoMotocicleta).join(', '),
    })
    tipo!: TipoMotocicleta;
    
  


}

export class CamionetaDto extends BaseVehiculoDto {
    @IsString() 
    @IsNotEmpty({ message: 'La cabina no puede estar vacía' }) // Validación para asegurarse de que la cabina no esté vacía
    @MinLength(3, { message: 'La cabina debe tener al menos 3 caracteres         ' })
    @MaxLength(20, { message: 'La cabina no puede tener más de 20 caracteres' })
    @Matches(/^[A-Za-z\s]+$/, { message: 'La cabina solo puede contener letras y espacios' }) // Validación para asegurarse de que la cabina solo contenga letras y espacios        
    cabina!: string;
    @IsNumber()
    @Min(0.1, { message: 'La capacidad de carga debe ser al menos 0.1' })
    @Max(10000, { message: 'La capacidad de carga no puede ser mayor a 10000' })
    capacidadCarga!: number;
}

export class CreateVehiculoDto {
  @IsIn(['auto', 'moto', 'camioneta'])
  tipo!: string;

  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object as CreateVehiculoDto;
    if (!object) return BaseVehiculoDto;

    switch (object.tipo) {
      case 'auto':
        return AutoDto;
      case 'moto':
        return MotoDto;
      case 'camioneta':
        return CamionetaDto;
      default:
        return BaseVehiculoDto;
    }
  })
  datos!: AutoDto | MotoDto | CamionetaDto;

  
}

//COMPLETO USUARIOS-ROLES
//ZONAS COMPLETO 
//VEHICULOS- REGISTO VEHICULOS CORRECTAMENTE 
//RELACIONAR VEHICULO PROPIETARIO -> 
//VALIDAR QUE EL VEHICULO PERTENEZCA AL PROPIETARIO
//NECESITO CREAR EMITIR TICKETS 
//API GATEWAY ->TOMAR EN CUENTA  


