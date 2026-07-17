import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { ConfigService } from '@nestjs/config';
import { Persona } from './interfaces/persona.interface';
import { Espacio } from './interfaces/espacio.interface';
import { HttpClientService } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { AuditEvent, EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

interface Vehiculo {
  placa: string;
  [key: string]: unknown;
}

interface EspacioApiResponse {
  id: string;
  nombre: string;
  estado: string;
  nombreZona?: string;
}

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly personaUrl: string;
  private readonly espacioUrl: string;
  private readonly vehiculosUrl: string;
  private readonly tarifaPorHora: number;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly eventPublisher: EventPublisher,
    private readonly cacheService: CacheService,
  ) {
    this.personaUrl = this.configService.get<string>('MS_PERSONA', '');
    this.espacioUrl =
      this.configService.get<string>('MS_ESPACIOS', '') ||
      this.configService.get<string>('MS_ZONAS', '').replace('/zonas', '/espacios');
    this.vehiculosUrl = this.configService.get<string>('MS_VEHICULOS', '');
    this.tarifaPorHora = Number(this.configService.get<string>('TARIFA_HORA', '1.0'));
  }

  private async emitEvent(accion: string, ticket: Ticket, userId?: string, ip?: string, datosExtra?: any) {
    const event: AuditEvent = {
      servicio: 'ms-tickets',
      accion,
      entidad: 'Ticket',
      datos: { ...ticket, ...datosExtra },
      usuario: userId || 'system',
      ip: ip || '127.0.0.1',
      mac: 'N/A',
    };
    await this.eventPublisher.publishEvent(event);
  }

  async create(
    createTicketDto: CreateTicketDto,
    authorization?: string,
    emisorUserId?: string,
    ip?: string,
  ): Promise<Ticket> {
    const persona = await this.validarPersona(createTicketDto.dni, authorization);
    if (!persona) {
      throw new BadRequestException(`No se encontró una persona con DNI ${createTicketDto.dni}`);
    }

    const vehiculo = await this.validarPlaca(createTicketDto.placa);
    if (!vehiculo) {
      throw new BadRequestException(`No se encontró un vehículo con placa ${createTicketDto.placa}`);
    }

    const espacio = await this.buscarEspacioDisponible(createTicketDto.idEspacio, authorization);
    if (!espacio) {
      throw new BadRequestException(
        `No se encontró un espacio disponible con ID ${createTicketDto.idEspacio}`,
      );
    }

    const ticketActivo = await this.validarTicketActivo(createTicketDto.placa);
    if (ticketActivo) {
      throw new BadRequestException(
        `El vehículo con placa ${createTicketDto.placa} ya tiene un ticket activo`,
      );
    }

    const ticketGuardado = await this.emitirTicket(createTicketDto, espacio, authorization, emisorUserId);
    this.logger.log(`Ticket creado con ID ${ticketGuardado.id} para placa ${createTicketDto.placa}`);
    await this.emitEvent('CREATE', ticketGuardado, emisorUserId, ip);
    return ticketGuardado;
  }

  findAll(ownerUserId?: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: ownerUserId ? { emisorUserId: ownerUserId } : {},
      order: { fechhaHoraIngreso: 'DESC' },
    });
  }

  async findOne(id: string, ownerUserId?: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket || (ownerUserId && ticket.emisorUserId !== ownerUserId)) {
      throw new NotFoundException(`Ticket con id ${id} no encontrado`);
    }
    return ticket;
  }

  async findActivos(ownerUserId?: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: ownerUserId ? { activo: true, emisorUserId: ownerUserId } : { activo: true },
      order: { fechhaHoraIngreso: 'DESC' },
    });
  }

  async cerrarTicket(
    id: string,
    updateTicketDto: UpdateTicketDto,
    authorization?: string,
    cobradorUserId?: string,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (!ticket.activo) {
      throw new BadRequestException(`El ticket con id ${id} ya está cerrado`);
    }

    if (updateTicketDto.activo === true) {
      throw new BadRequestException(
        'No se puede reactivar un ticket. Envíe activo: false para cerrarlo.',
      );
    }

    const fechaSalida = updateTicketDto.fechhaHoraSalida
      ? new Date(updateTicketDto.fechhaHoraSalida)
      : new Date();

    if (Number.isNaN(fechaSalida.getTime())) {
      throw new BadRequestException('fechhaHoraSalida no es una fecha válida');
    }

    const ingresoDate = this.toDate(ticket.fechhaHoraIngreso);
    if (fechaSalida.getTime() < ingresoDate.getTime()) {
      throw new BadRequestException(
        'fechhaHoraSalida no puede ser anterior a fechhaHoraIngreso',
      );
    }

    const horas = this.calcularHorasCobro(ticket.fechhaHoraIngreso, fechaSalida);
    const costo = this.calcularCosto(horas);

    ticket.activo = false;
    ticket.fechhaHoraSalida = fechaSalida;
    ticket.valorRecaudo = costo;
    ticket.cobradorUserId = cobradorUserId;

    await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE', authorization);

    const closedTicket = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket con ID ${id} cerrado`);
    await this.emitEvent('UPDATE', closedTicket, cobradorUserId, ip, {
      valorRecaudo: closedTicket.valorRecaudo,
      cobradorUserId,
    });
    return closedTicket;
  }

  async remove(id: string, userId?: string, ip?: string): Promise<void> {
    const ticket = await this.findOne(id);
    await this.emitEvent('DELETE', ticket, userId, ip);
    await this.ticketRepository.remove(ticket);
  }

  private async validarPersona(dni: string, authorization?: string): Promise<Persona | null> {
    try {
      const url = `${this.personaUrl}/${dni}`;
      return await this.httpClient.get<Persona>(url, authorization);
    } catch (error) {
      this.logger.error(`Error al validar persona ${dni}: ${error}`);
      return null;
    }
  }

  private async validarPlaca(placa: string): Promise<Vehiculo | null> {
    const cacheKey = `vehiculo:${placa}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) return cached;

    try {
      const serviceToken = await this.serviceTokenService.getServiceToken();
      const url = `${this.vehiculosUrl}/placa/${encodeURIComponent(placa)}`;
      const vehiculo = await this.httpClient.get<Vehiculo>(url, serviceToken);
      if (vehiculo) {
        await this.cacheService.set(cacheKey, vehiculo);
      }
      return vehiculo;
    } catch (error) {
      this.logger.error(`Error al validar placa ${placa}: ${error}`);
      return null;
    }
  }

  private async buscarEspacioDisponible(
    idEspacio: string,
    authorization?: string,
  ): Promise<Espacio | null> {
    try {
      const cacheKey = `espacio:${idEspacio}`;
      let espacio = await this.cacheService.get<EspacioApiResponse>(cacheKey);
      if (!espacio) {
        const url = `${this.espacioUrl}/${idEspacio}`;
        espacio = await this.httpClient.get<EspacioApiResponse>(url, authorization);
        await this.cacheService.set(cacheKey, espacio);
      }
      const espacioId = String(espacio.id);

      if (espacio.estado !== 'DISPONIBLE') {
        this.logger.warn(`Espacio ${idEspacio} no está DISPONIBLE, estado actual: ${espacio.estado}`);
        return null;
      }

      return {
        id: espacioId,
        estado: espacio.estado,
        codigo: espacio.nombre,
        zona: espacio.nombreZona ?? '',
        nombreZona: espacio.nombreZona,
        disponible: true,
      };
    } catch (error) {
      this.logger.error(`Error al buscar espacio ${idEspacio}: ${error}`);
      return null;
    }
  }

  private async validarTicketActivo(placa: string): Promise<Ticket | null> {
    return this.ticketRepository.findOne({
      where: { placa, activo: true },
    });
  }

  private toDate(fecha: Date | string): Date {
    return fecha instanceof Date ? fecha : new Date(fecha);
  }

  /**
   * Calcula las horas a cobrar según el tiempo de permanencia.
   * Se redondea hacia arriba (cada fracción de hora cuenta como hora completa)
   * y se aplica un mínimo de 1 hora.
   */
  private calcularHorasCobro(ingreso: Date | string, salida: Date | string): number {
    const ingresoDate = this.toDate(ingreso);
    const salidaDate = this.toDate(salida);

    const diffMs = salidaDate.getTime() - ingresoDate.getTime();
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return 1;
    }

    const horasTranscurridas = diffMs / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(horasTranscurridas));
  }

  private calcularCosto(horas: number): number {
    return Number((horas * this.tarifaPorHora).toFixed(2));
  }

  private async emitirTicket(
    createTicketDto: CreateTicketDto,
    espacio: Espacio,
    authorization?: string,
    emisorUserId?: string,
  ): Promise<Ticket> {
    await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'OCUPADO', authorization);

    const ticket = this.ticketRepository.create({
      placa: createTicketDto.placa,
      dni: createTicketDto.dni,
      idEspacio: createTicketDto.idEspacio,
      nombreZona: espacio.nombreZona ?? espacio.zona ?? '',
      fechhaHoraIngreso: new Date(),
      activo: true,
      valorRecaudo: 0,
      emisorUserId,
    });

    try {
      return await this.ticketRepository.save(ticket);
    } catch (error) {
      await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'DISPONIBLE', authorization);
      throw error;
    }
  }

  private async actualizarEstadoEspacio(
    idEspacio: string,
    estado: string,
    authorization?: string,
  ): Promise<void> {
    const url = `${this.espacioUrl}/${idEspacio}/estado?estado=${estado}`;
    await this.httpClient.put<Espacio>(url, authorization);
    // El estado del espacio cambió: se invalida la copia en caché
    await this.cacheService.del(`espacio:${idEspacio}`);
  }
}
