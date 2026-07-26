import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { IsNull, Repository } from 'typeorm';
import { FactoryVehiculos } from './factory/factory-vehiculos';
import { AuditEvent, EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

// Un mismo carro físico puede estar registrado en varias empresas, pero sus
// características técnicas son las mismas en todas: se validan al crear/editar.
const CARACTERISTICAS = ['marca', 'modelo', 'color', 'anio', 'clasificacion'] as const;

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

// Tipo de vehículo tal como lo maneja el formulario (auto/moto/camioneta)
private tipoFormulario(vehiculo: Vehiculo): string | undefined {
  const tipo = typeof vehiculo.obtenerTipo === 'function' ? vehiculo.obtenerTipo() : undefined;
  switch (tipo) {
    case 'Auto': return 'auto';
    case 'Moto': return 'moto';
    case 'Camioneta': return 'camioneta';
    default: return undefined;
  }
}

// Mismo carro físico ya registrado por otra empresa (misma placa, tenant distinto)
private async otraEmpresaConPlaca(placa: string, tenantId: string | null): Promise<Vehiculo | null> {
  const registros = await this.vehiculoRepository.find({ where: { placa } });
  return registros.find((v) => (v.tenantId ?? null) !== (tenantId ?? null)) ?? null;
}

private normalizar(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase();
}

// Devuelve la lista de características que no coinciden con el registro existente
private compararCaracteristicas(
  existente: Vehiculo,
  valores: Record<string, any>,
  tipoNuevo?: string,
): string[] {
  const diferencias: string[] = [];
  const tipoExistente = this.tipoFormulario(existente);
  if (tipoNuevo && tipoExistente && tipoExistente !== tipoNuevo.toLowerCase()) {
    diferencias.push(`tipo: registrado como "${tipoExistente}"`);
  }
  for (const campo of CARACTERISTICAS) {
    const actual = (existente as any)[campo];
    const nuevo = valores[campo];
    if (nuevo !== undefined && this.normalizar(actual) !== this.normalizar(nuevo)) {
      diferencias.push(`${campo}: registrado como "${actual}"`);
    }
  }
  return diferencias;
}

private validarCoherencia(existente: Vehiculo, placa: string, diferencias: string[]) {
  if (diferencias.length > 0) {
    throw new ConflictException({
      message:
        `La placa ${placa} ya está registrada en otra empresa con otras características. ` +
        'Use "Confirmar datos" para traer los datos registrados.',
      diferencias,
    });
  }
}

/**
 * Consulta la placa en todas las empresas para autocompletar el formulario.
 * Devuelve solo las características del vehículo: nunca el id, el tenant ni
 * datos de la empresa que lo registró.
 */
async consultarPlacaGlobal(placa: string): Promise<{
  encontrado: boolean;
  tipoVehiculo?: string;
  datos?: Record<string, any>;
}> {
  const vehiculo = await this.vehiculoRepository.findOne({ where: { placa } });
  if (!vehiculo) {
    return { encontrado: false };
  }
  const datos: Record<string, any> = { ...vehiculo };
  delete datos.id;
  delete datos.tenantId;
  return { encontrado: true, tipoVehiculo: this.tipoFormulario(vehiculo), datos };
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
  const registrado = await this.otraEmpresaConPlaca(createVehiculoDto.datos.placa, tenantId);
  if (registrado) {
    this.validarCoherencia(
      registrado,
      createVehiculoDto.datos.placa,
      this.compararCaracteristicas(registrado, createVehiculoDto.datos as any, createVehiculoDto.tipo),
    );
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
    // Actualizar solo los campos proporcionados: el DTO trae como undefined los
    // que no se enviaron y copiarlos borraría los valores actuales de la entidad
    const cambios = Object.fromEntries(
      Object.entries(updateVehiculoDto).filter(([, valor]) => valor !== undefined),
    );
    Object.assign(vehiculo, cambios);
    // La edición tampoco puede dejar la misma placa con datos distintos en otra empresa
    const registrado = await this.otraEmpresaConPlaca(vehiculo.placa, tenantId);
    if (registrado) {
      this.validarCoherencia(
        registrado,
        vehiculo.placa,
        this.compararCaracteristicas(registrado, vehiculo as any),
      );
    }
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
