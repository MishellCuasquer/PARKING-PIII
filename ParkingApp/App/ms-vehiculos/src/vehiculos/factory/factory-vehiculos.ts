import { CreateVehiculoDto } from '../dto/create-vehiculo.dto';
import { Auto } from '../entities/auto.entity';
import { Camioneta } from '../entities/camioneta.entity';
import { Motocicleta } from '../entities/motocicleta.entity';
import { Vehiculo } from '../entities/vehiculo.entity';

export class FactoryVehiculos {
  static crear(dto: CreateVehiculoDto): Vehiculo {
    switch (dto.tipo.toLowerCase()) {

      case 'auto':
        const auto = new Auto();
        Object.assign(auto, dto.datos);
        return auto;

      case 'moto':
        const moto = new Motocicleta();
        Object.assign(moto, dto.datos);
        return moto;

      case 'camioneta':
        const camioneta = new Camioneta();
        Object.assign(camioneta, dto.datos);
        return camioneta;

      default:
        throw new Error(`Tipo de vehículo no soportado: ${dto.tipo}`);
    }
  }
}