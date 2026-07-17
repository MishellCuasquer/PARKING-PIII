import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Repository } from 'typeorm';
import { FactoryVehiculos } from './factory/factory-vehiculos';
import { AuditEvent, EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

@Injectable()
export class VehiculosService {


constructor(
  @InjectRepository(Vehiculo)
  private vehiculoRepository: Repository<Vehiculo>,
  private eventPublisher: EventPublisher,
  private cacheService: CacheService
) {}

// Método auxiliar para publicar eventos
  private async emitEvent(accion: string, vehiculo: Vehiculo, userId?: string, ip?: string, datosExtra?: any) {
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion,
      entidad: 'Vehiculo',
      datos: { ...vehiculo, ...datosExtra },
      usuario: userId || 'system',
      ip: ip || '127.0.0.1',
      mac: 'N/A' // No es posible obtener MAC en aplicaciones web por seguridad
    };
    await this.eventPublisher.publishEvent(event);
  }
async create(createVehiculoDto: CreateVehiculoDto, userId?: string, ip?: string): Promise<Vehiculo> {
  const existe = await this.vehiculoRepository.findOne({
    where: { placa: createVehiculoDto.datos.placa } });
  if (existe) {
    throw new ConflictException('Vehículo ya existe con esta placa' );
  }
  const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
  const saved = await this.vehiculoRepository.save(vehiculo);
  await this.emitEvent('CREATE', saved, userId, ip);
  return saved;
}


  async findAll(): Promise<Vehiculo[]> {
    return this.vehiculoRepository.find();
  }

  async findOne(id: string): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepository.findOne({ where: { id } });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return vehiculo;
  }

  async findByPlaca(placa: string): Promise<Vehiculo> {
    const cacheKey = `vehiculo:${placa}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) return cached;

    const vehiculo = await this.vehiculoRepository.findOne({ where: { placa } });
    if (!vehiculo) {
      throw new NotFoundException(`Vehículo no encontrado con placa ${placa}`);
    }
    await this.cacheService.set(cacheKey, vehiculo);
    return vehiculo;
  }

  async update(id: string, updateVehiculoDto: UpdateVehiculoDto, userId?: string, ip?: string): Promise<Vehiculo> {
    const vehiculo = await this.findOne(id);
    const placaAnterior = vehiculo.placa;
    // Actualizar solo los campos proporcionados
    Object.assign(vehiculo, updateVehiculoDto);
    const updated = await this.vehiculoRepository.save(vehiculo);
    // Recargar el vehículo para obtener todos los campos correctamente
    const reloaded = await this.findOne(updated.id);
    // Invalidar la caché (la placa pudo haber cambiado)
    await this.cacheService.del(`vehiculo:${placaAnterior}`);
    if (reloaded.placa !== placaAnterior) {
      await this.cacheService.del(`vehiculo:${reloaded.placa}`);
    }
    // Enviar solo los campos modificados en auditoría
    await this.emitEvent('UPDATE', reloaded, userId, ip, { camposModificados: updateVehiculoDto });
    return reloaded;
  }

  async remove(id: string, userId?: string, ip?: string): Promise<void> {
    const vehiculo = await this.findOne(id);
    await this.emitEvent('DELETE', vehiculo, userId, ip);
    await this.vehiculoRepository.remove(vehiculo);
    await this.cacheService.del(`vehiculo:${vehiculo.placa}`);
  }
}
