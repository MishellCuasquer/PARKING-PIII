import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Repository } from 'typeorm';
import { FactoryVehiculos } from './factory/factory-vehiculos';

@Injectable()
export class VehiculosService {

constructor(
  @InjectRepository(Vehiculo) 
  private vehiculoRepository: Repository<Vehiculo>,
) {}

async create(createVehiculoDto: CreateVehiculoDto): Promise<Vehiculo> {
  const existe = await this.vehiculoRepository.findOne({ 
    where: { placa: createVehiculoDto.datos.placa } });
  if (existe) {
    throw new Error('Vehículo ya existe con esta placa' );
  }
  const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
  return this.vehiculoRepository.save(vehiculo);

}


  async findAll(): Promise<Vehiculo[]> {
    return this.vehiculoRepository.find();
  }

  async findOne(id: string): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepository.findOne({ where: { id } });
    if (!vehiculo) {
      throw new Error('Vehículo no encontrado');
    }
    return vehiculo;
  }

  async findByPlaca(placa: string): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepository.findOne({ where: { placa } });
    if (!vehiculo) {
      throw new NotFoundException(`Vehículo no encontrado con placa ${placa}`);
    }
    return vehiculo;
  }

  async update(id: string, updateVehiculoDto: UpdateVehiculoDto): Promise<Vehiculo> {
    const vehiculo = await this.findOne(id);
    Object.assign(vehiculo, updateVehiculoDto);
    return this.vehiculoRepository.save(vehiculo);
  }

  async remove(id: string): Promise<void> {
    const vehiculo = await this.findOne(id);
    await this.vehiculoRepository.remove(vehiculo);
  }
}
