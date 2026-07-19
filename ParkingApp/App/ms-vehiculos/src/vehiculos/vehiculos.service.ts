import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { IsNull, Repository } from 'typeorm';
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

// tenantId null (datos legacy / cuentas globales) se traduce a IS NULL en el where
private tenantWhere(tenantId: string | null) {
  return tenantId ?? IsNull();
}

// Claves de caché con namespace por tenant para evitar colisiones entre empresas
private cacheKey(tenantId: string | null, placa: string): string {
  return `t:${tenantId ?? 'global'}:vehiculo:${placa}`;
}

// Método auxiliar para publicar eventos
  private async emitEvent(accion: string, vehiculo: Vehiculo, tenantId?: string | null, userId?: string, ip?: string, datosExtra?: any) {
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion,
      entidad: 'Vehiculo',
      datos: { ...vehiculo, ...datosExtra },
      usuario: userId || 'system',
      ip: ip || '127.0.0.1',
      mac: 'N/A', // No es posible obtener MAC en aplicaciones web por seguridad
      tenantId: tenantId ?? undefined
    };
    await this.eventPublisher.publishEvent(event);
  }
async create(createVehiculoDto: CreateVehiculoDto, tenantId: string | null, userId?: string, ip?: string): Promise<Vehiculo> {
  const existe = await this.vehiculoRepository.findOne({
    where: { placa: createVehiculoDto.datos.placa, tenantId: this.tenantWhere(tenantId) } });
  if (existe) {
    throw new ConflictException('Vehículo ya existe con esta placa' );
  }
  const vehiculo = FactoryVehiculos.crear(createVehiculoDto);
  vehiculo.tenantId = tenantId;
  const saved = await this.vehiculoRepository.save(vehiculo);
  await this.emitEvent('CREATE', saved, tenantId, userId, ip);
  return saved;
}


  async findAll(tenantId: string | null): Promise<Vehiculo[]> {
    return this.vehiculoRepository.find({ where: { tenantId: this.tenantWhere(tenantId) } });
  }

  async findOne(id: string, tenantId: string | null): Promise<Vehiculo> {
    const vehiculo = await this.vehiculoRepository.findOne({
      where: { id, tenantId: this.tenantWhere(tenantId) } });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado');
    }
    return vehiculo;
  }

  async findByPlaca(placa: string, tenantId: string | null): Promise<Vehiculo> {
    const cacheKey = this.cacheKey(tenantId, placa);
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) return cached;

    const vehiculo = await this.vehiculoRepository.findOne({
      where: { placa, tenantId: this.tenantWhere(tenantId) } });
    if (!vehiculo) {
      throw new NotFoundException(`Vehículo no encontrado con placa ${placa}`);
    }
    await this.cacheService.set(cacheKey, vehiculo);
    return vehiculo;
  }

  async update(id: string, updateVehiculoDto: UpdateVehiculoDto, tenantId: string | null, userId?: string, ip?: string): Promise<Vehiculo> {
    const vehiculo = await this.findOne(id, tenantId);
    const placaAnterior = vehiculo.placa;
    // Actualizar solo los campos proporcionados
    Object.assign(vehiculo, updateVehiculoDto);
    const updated = await this.vehiculoRepository.save(vehiculo);
    // Recargar el vehículo para obtener todos los campos correctamente
    const reloaded = await this.findOne(updated.id, tenantId);
    // Invalidar la caché (la placa pudo haber cambiado)
    await this.cacheService.del(this.cacheKey(tenantId, placaAnterior));
    if (reloaded.placa !== placaAnterior) {
      await this.cacheService.del(this.cacheKey(tenantId, reloaded.placa));
    }
    // Enviar solo los campos modificados en auditoría
    await this.emitEvent('UPDATE', reloaded, tenantId, userId, ip, { camposModificados: updateVehiculoDto });
    return reloaded;
  }

  async remove(id: string, tenantId: string | null, userId?: string, ip?: string): Promise<void> {
    const vehiculo = await this.findOne(id, tenantId);
    await this.emitEvent('DELETE', vehiculo, tenantId, userId, ip);
    await this.vehiculoRepository.remove(vehiculo);
    await this.cacheService.del(this.cacheKey(tenantId, vehiculo.placa));
  }
}
