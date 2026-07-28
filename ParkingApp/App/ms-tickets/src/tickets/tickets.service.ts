import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { ConfigService } from '@nestjs/config';
import { Persona } from './interfaces/persona.interface';
import { Espacio } from './interfaces/espacio.interface';
import { HttpClientService, UpstreamHttpError } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { AuditEvent, EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';
import { TenantConfigService } from '../common/tenant-config.service';

interface Vehiculo {
  placa: string;
  // 'auto' | 'moto' | 'camioneta' (lo devuelve ms-vehiculos en ResponseVehiculoDto)
  tipo?: string;
  [key: string]: unknown;
}

interface EspacioApiResponse {
  id: string;
  nombre: string;
  estado: string;
  nombreZona?: string;
  // Tipo de vehículo para el que sirve el espacio: AUTO, MOTO, BUSETA, BUS, CAMION
  tipoEspacio?: string;
}

/**
 * Espacios en los que puede aparcar cada tipo de vehículo.
 *
 * Un auto no cabe en un espacio de moto: esa es la razón de ser de esta tabla.
 * Al revés tampoco se permite, porque ocupar una plaza de auto con una moto
 * desperdicia sitio y descuadra el aforo de la zona.
 *
 * La camioneta admite dos destinos: entra en una plaza de auto normal y también
 * en una de camión, que es lo que se hace en la práctica.
 */
const ESPACIOS_COMPATIBLES: Record<string, string[]> = {
  auto: ['AUTO'],
  moto: ['MOTO'],
  camioneta: ['AUTO', 'CAMION'],
};

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly personaUrl: string;
  private readonly espacioUrl: string;
  private readonly vehiculosUrl: string;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly httpClient: HttpClientService,
    private readonly configService: ConfigService,
    private readonly serviceTokenService: ServiceTokenService,
    private readonly eventPublisher: EventPublisher,
    private readonly cacheService: CacheService,
    private readonly tenantConfigService: TenantConfigService,
  ) {
    this.personaUrl = this.configService.get<string>('MS_PERSONA', '');
    this.espacioUrl =
      this.configService.get<string>('MS_ESPACIOS', '') ||
      this.configService.get<string>('MS_ZONAS', '').replace('/zonas', '/espacios');
    this.vehiculosUrl = this.configService.get<string>('MS_VEHICULOS', '');
  }

  // tenantId null (datos legacy) se traduce a IS NULL en el where
  private tenantWhere(tenantId?: string | null) {
    return tenantId ?? IsNull();
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
      tenantId: ticket.tenantId ?? undefined,
    };
    await this.eventPublisher.publishEvent(event);
  }

  async create(
    createTicketDto: CreateTicketDto,
    tenantId: string | null,
    authorization?: string,
    emisorUserId?: string,
    ip?: string,
  ): Promise<Ticket> {
    const persona = await this.validarPersona(createTicketDto.dni, tenantId, authorization);
    if (!persona) {
      throw new BadRequestException(`No se encontró una persona con DNI ${createTicketDto.dni}`);
    }

    const vehiculo = await this.validarPlaca(createTicketDto.placa, tenantId);
    if (!vehiculo) {
      throw new BadRequestException(`No se encontró un vehículo con placa ${createTicketDto.placa}`);
    }

    // La unicidad se comprueba ANTES de tocar el espacio: si se rechazara
    // después, el espacio ya habría quedado ocupado por un ticket inexistente.
    const ticketActivo = await this.validarTicketActivo(createTicketDto.placa);
    if (ticketActivo) {
      const mismaEmpresa = (ticketActivo.tenantId ?? null) === (tenantId ?? null);
      throw new ConflictException(
        mismaEmpresa
          ? `El vehículo con placa ${createTicketDto.placa} ya tiene un ticket activo`
          : `El vehículo con placa ${createTicketDto.placa} está dentro de otro parqueadero. ` +
            'Debe registrarse su salida antes de poder ingresar aquí.',
      );
    }

    // ms-zonas valida con el token del usuario que el espacio sea de su tenant (ajeno → 404)
    const espacio = await this.buscarEspacio(createTicketDto.idEspacio, authorization);
    if (!espacio) {
      throw new NotFoundException(
        `No se encontró un espacio con ID ${createTicketDto.idEspacio}`,
      );
    }

    this.validarCompatibilidad(vehiculo, espacio);

    const ticketGuardado = await this.emitirTicket(createTicketDto, espacio, tenantId, authorization, emisorUserId);
    this.logger.log(`Ticket creado con ID ${ticketGuardado.id} para placa ${createTicketDto.placa}`);
    await this.emitEvent('CREATE', ticketGuardado, emisorUserId, ip);
    return ticketGuardado;
  }

  findAll(tenantId: string | null, ownerUserId?: string): Promise<Ticket[]> {
    const where: FindOptionsWhere<Ticket> = { tenantId: this.tenantWhere(tenantId) };
    if (ownerUserId) {
      where.emisorUserId = ownerUserId;
    }
    return this.ticketRepository.find({
      where,
      order: { fechhaHoraIngreso: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string | null, ownerUserId?: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id, tenantId: this.tenantWhere(tenantId) },
    });
    if (!ticket || (ownerUserId && ticket.emisorUserId !== ownerUserId)) {
      throw new NotFoundException(`Ticket con id ${id} no encontrado`);
    }
    return ticket;
  }

  async findActivos(tenantId: string | null, ownerUserId?: string): Promise<Ticket[]> {
    const where: FindOptionsWhere<Ticket> = {
      activo: true,
      tenantId: this.tenantWhere(tenantId),
    };
    if (ownerUserId) {
      where.emisorUserId = ownerUserId;
    }
    return this.ticketRepository.find({
      where,
      order: { fechhaHoraIngreso: 'DESC' },
    });
  }

  async cerrarTicket(
    id: string,
    updateTicketDto: UpdateTicketDto,
    tenantId: string | null,
    authorization?: string,
    cobradorUserId?: string,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id, tenantId);

    // Se comprueba antes de liberar el espacio y de publicar el evento: un
    // segundo cierre no debe soltar la plaza otra vez ni duplicar la auditoría.
    if (!ticket.activo) {
      throw new ConflictException(`El ticket con id ${id} ya está cerrado`);
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
    // La tarifa es la de la empresa dueña del TICKET, no la del usuario que
    // cobra: si un operador cierra un ticket emitido bajo otra configuración,
    // el precio sigue siendo el que corresponde a ese parqueadero.
    const costo = await this.calcularCosto(horas, ticket.tenantId ?? null);

    ticket.activo = false;
    ticket.fechhaHoraSalida = fechaSalida;
    ticket.valorRecaudo = costo;
    ticket.cobradorUserId = cobradorUserId;

    await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE', tenantId, authorization);

    const closedTicket = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket con ID ${id} cerrado`);
    await this.emitEvent('UPDATE', closedTicket, cobradorUserId, ip, {
      valorRecaudo: closedTicket.valorRecaudo,
      cobradorUserId,
    });
    return closedTicket;
  }

  async remove(id: string, tenantId: string | null, userId?: string, ip?: string): Promise<void> {
    const ticket = await this.findOne(id, tenantId);
    await this.emitEvent('DELETE', ticket, userId, ip);
    await this.ticketRepository.remove(ticket);
  }

  // La consulta a ms-usuarios es costosa: se cachea por tenant igual que vehículo/espacio
  private async validarPersona(dni: string, tenantId: string | null, authorization?: string): Promise<Persona | null> {
    const cacheKey = `t:${tenantId ?? 'global'}:persona:${dni}`;
    const cached = await this.cacheService.get<Persona>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.personaUrl}/${dni}`;
      const persona = await this.httpClient.get<Persona>(url, authorization);
      if (persona) {
        await this.cacheService.set(cacheKey, persona);
      }
      return persona;
    } catch (error) {
      this.logger.error(`Error al validar persona ${dni}: ${error}`);
      return null;
    }
  }

  /**
   * Impide emitir un ticket de un auto en un espacio de moto (y viceversa).
   *
   * Es permisiva a propósito cuando falta información: si el vehículo no
   * declara tipo o el espacio no declara `tipoEspacio` —datos anteriores a
   * que se expusiera este campo— deja pasar. Bloquear por un dato ausente
   * dejaría sin poder entrar a vehículos ya registrados.
   */
  private validarCompatibilidad(vehiculo: Vehiculo, espacio: Espacio): void {
    const tipoVehiculo = vehiculo.tipo?.toLowerCase();
    const tipoEspacio = espacio.tipoEspacio?.toUpperCase();

    if (!tipoVehiculo || !tipoEspacio) {
      return;
    }

    const compatibles = ESPACIOS_COMPATIBLES[tipoVehiculo];
    if (!compatibles || compatibles.includes(tipoEspacio)) {
      return;
    }

    throw new BadRequestException(
      `El espacio ${espacio.codigo} es para vehículos de tipo ${tipoEspacio} ` +
        `y el vehículo ${vehiculo.placa} es ${tipoVehiculo.toUpperCase()}. ` +
        'Seleccione un espacio compatible.',
    );
  }

  private async validarPlaca(placa: string, tenantId: string | null): Promise<Vehiculo | null> {
    const cacheKey = `t:${tenantId ?? 'global'}:vehiculo:${placa}`;
    const cached = await this.cacheService.get<Vehiculo>(cacheKey);
    if (cached) return cached;

    try {
      const serviceToken = await this.serviceTokenService.getServiceToken();
      const url = `${this.vehiculosUrl}/placa/${encodeURIComponent(placa)}`;
      // El token de servicio no tiene tenant: se propaga el del usuario original por header
      const vehiculo = await this.httpClient.get<Vehiculo>(url, serviceToken, tenantId);
      if (vehiculo) {
        await this.cacheService.set(cacheKey, vehiculo);
      }
      return vehiculo;
    } catch (error) {
      this.logger.error(`Error al validar placa ${placa}: ${error}`);
      return null;
    }
  }

  /**
   * Lee el espacio de ms-zonas SIN pasar por la caché.
   *
   * El estado de un espacio cambia por debajo de este servicio (un
   * administrador puede ponerlo en mantenimiento desde ms-zonas) y una copia
   * cacheada durante 60 s bastaba para emitir un ticket sobre una plaza que ya
   * no estaba libre. La caché sigue valiéndose para vehículo y persona, que sí
   * son estables.
   *
   * Aquí no se decide la disponibilidad: de eso se encarga la ocupación
   * atómica en {@link emitirTicket}. Esta lectura solo aporta el tipo de
   * espacio y el nombre de la zona.
   */
  private async buscarEspacio(idEspacio: string, authorization?: string): Promise<Espacio | null> {
    try {
      const url = `${this.espacioUrl}/${idEspacio}`;
      const espacio = await this.httpClient.get<EspacioApiResponse>(url, authorization);

      return {
        id: String(espacio.id),
        estado: espacio.estado,
        codigo: espacio.nombre,
        zona: espacio.nombreZona ?? '',
        nombreZona: espacio.nombreZona,
        tipoEspacio: espacio.tipoEspacio,
        disponible: espacio.estado === 'DISPONIBLE',
      };
    } catch (error) {
      this.logger.error(`Error al buscar espacio ${idEspacio}: ${error}`);
      return null;
    }
  }

  /**
   * Un mismo carro no puede estar dentro de dos parqueaderos a la vez: el ticket
   * activo se busca en TODAS las empresas, no solo en la del solicitante. Hasta
   * que no se cierre (registre la salida) no puede ingresar a otro parqueadero.
   */
  private async validarTicketActivo(placa: string): Promise<Ticket | null> {
    return this.ticketRepository.findOne({ where: { placa, activo: true } });
  }

  private toDate(fecha: Date | string): Date {
    return fecha instanceof Date ? fecha : new Date(fecha);
  }

  /**
   * Horas a cobrar según el tiempo de permanencia.
   *
   * La fracción se cobra de forma PROPORCIONAL, no como hora completa: quien
   * se queda hora y media paga hora y media, no dos horas. Lo único que se
   * redondea es el importe final, a céntimos (ver calcularCosto).
   *
   * Se mantiene un mínimo de 1 hora: una estancia de 10 minutos paga la hora,
   * que es la tarifa mínima habitual de un parqueadero.
   */
  private calcularHorasCobro(ingreso: Date | string, salida: Date | string): number {
    const ingresoDate = this.toDate(ingreso);
    const salidaDate = this.toDate(salida);

    const diffMs = salidaDate.getTime() - ingresoDate.getTime();
    if (Number.isNaN(diffMs) || diffMs <= 0) {
      return 1;
    }

    const horasTranscurridas = diffMs / (1000 * 60 * 60);
    return Math.max(1, horasTranscurridas);
  }

  /**
   * Coste del ticket según la tarifa POR EMPRESA (modelo SaaS multitenant).
   * TARIFA_HORA del entorno pasa a ser solo el respaldo: se usa cuando el
   * ticket no tiene tenant o cuando ms-usuarios no está disponible.
   *
   * Aquí es donde se redondea, y solo aquí: a 2 decimales, porque el importe
   * se cobra en dólares y no existen fracciones de céntimo.
   */
  private async calcularCosto(horas: number, tenantId: string | null): Promise<number> {
    const tarifa = await this.tenantConfigService.getTarifaHora(tenantId);
    return Number((horas * tarifa).toFixed(2));
  }

  /**
   * Emite el ticket ocupando primero el espacio.
   *
   * El orden importa: la ocupación es la operación atómica que decide quién
   * gana la plaza. ms-zonas la resuelve bajo bloqueo pesimista y responde 409
   * si el espacio dejó de estar libre entre la lectura y este momento, así que
   * de dos peticiones simultáneas solo una llega a crear el ticket.
   */
  private async emitirTicket(
    createTicketDto: CreateTicketDto,
    espacio: Espacio,
    tenantId: string | null,
    authorization?: string,
    emisorUserId?: string,
  ): Promise<Ticket> {
    await this.ocuparEspacio(createTicketDto.idEspacio, tenantId, authorization);

    const ticket = this.ticketRepository.create({
      placa: createTicketDto.placa,
      dni: createTicketDto.dni,
      idEspacio: createTicketDto.idEspacio,
      nombreZona: espacio.nombreZona ?? espacio.zona ?? '',
      fechhaHoraIngreso: new Date(),
      activo: true,
      valorRecaudo: 0,
      emisorUserId,
      tenantId,
    });

    try {
      return await this.ticketRepository.save(ticket);
    } catch (error) {
      await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'DISPONIBLE', tenantId, authorization);
      throw error;
    }
  }

  /**
   * Intenta ocupar el espacio y traduce el rechazo de ms-zonas a un 409 propio.
   *
   * El mensaje se reenvía tal cual porque ms-zonas ya explica el motivo con el
   * estado real ("el espacio no está disponible (estado: mantenimiento)"), que
   * es justo lo que el operador necesita leer.
   */
  private async ocuparEspacio(
    idEspacio: string,
    tenantId: string | null,
    authorization?: string,
  ): Promise<void> {
    try {
      await this.actualizarEstadoEspacio(idEspacio, 'OCUPADO', tenantId, authorization);
    } catch (error) {
      if (error instanceof UpstreamHttpError && error.status === 409) {
        this.logger.warn(`Espacio ${idEspacio} no se pudo ocupar: ${error.detalle}`);
        throw new ConflictException(error.detalle);
      }
      if (error instanceof UpstreamHttpError && error.status === 404) {
        throw new NotFoundException(`No se encontró un espacio con ID ${idEspacio}`);
      }
      throw error;
    }
  }

  private async actualizarEstadoEspacio(
    idEspacio: string,
    estado: string,
    tenantId: string | null,
    authorization?: string,
  ): Promise<void> {
    const url = `${this.espacioUrl}/${idEspacio}/estado?estado=${estado}`;
    await this.httpClient.put<Espacio>(url, authorization);
    // El estado del espacio cambió: se invalida la copia en caché
    await this.cacheService.del(`t:${tenantId ?? 'global'}:espacio:${idEspacio}`);
  }
}
