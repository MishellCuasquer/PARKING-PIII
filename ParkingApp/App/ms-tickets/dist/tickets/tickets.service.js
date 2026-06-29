"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TicketsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ticket_entity_1 = require("./entities/ticket.entity");
const config_1 = require("@nestjs/config");
const htppl_cliente_service_1 = require("../common/htppl-cliente.service");
const service_token_service_1 = require("../auth/service-token.service");
let TicketsService = TicketsService_1 = class TicketsService {
    ticketRepository;
    httpClient;
    configService;
    serviceTokenService;
    logger = new common_1.Logger(TicketsService_1.name);
    personaUrl;
    espacioUrl;
    vehiculosUrl;
    tarifaPorHora;
    constructor(ticketRepository, httpClient, configService, serviceTokenService) {
        this.ticketRepository = ticketRepository;
        this.httpClient = httpClient;
        this.configService = configService;
        this.serviceTokenService = serviceTokenService;
        this.personaUrl = this.configService.get('MS_PERSONA', '');
        this.espacioUrl =
            this.configService.get('MS_ESPACIOS', '') ||
                this.configService.get('MS_ZONAS', '').replace('/zonas', '/espacios');
        this.vehiculosUrl = this.configService.get('MS_VEHICULOS', '');
        this.tarifaPorHora = Number(this.configService.get('TARIFA_HORA', '1.0'));
    }
    async create(createTicketDto, authorization) {
        const persona = await this.validarPersona(createTicketDto.dni, authorization);
        if (!persona) {
            throw new common_1.BadRequestException(`No se encontró una persona con DNI ${createTicketDto.dni}`);
        }
        const vehiculo = await this.validarPlaca(createTicketDto.placa);
        if (!vehiculo) {
            throw new common_1.BadRequestException(`No se encontró un vehículo con placa ${createTicketDto.placa}`);
        }
        const espacio = await this.buscarEspacioDisponible(createTicketDto.idEspacio, authorization);
        if (!espacio) {
            throw new common_1.BadRequestException(`No se encontró un espacio disponible con ID ${createTicketDto.idEspacio}`);
        }
        const ticketActivo = await this.validarTicketActivo(createTicketDto.placa);
        if (ticketActivo) {
            throw new common_1.BadRequestException(`El vehículo con placa ${createTicketDto.placa} ya tiene un ticket activo`);
        }
        const ticketGuardado = await this.emitirTicket(createTicketDto, espacio, authorization);
        this.logger.log(`Ticket creado con ID ${ticketGuardado.id} para placa ${createTicketDto.placa}`);
        return ticketGuardado;
    }
    findAll() {
        return this.ticketRepository.find({ order: { fechhaHoraIngreso: 'DESC' } });
    }
    async findOne(id) {
        const ticket = await this.ticketRepository.findOne({ where: { id } });
        if (!ticket) {
            throw new common_1.NotFoundException(`Ticket con id ${id} no encontrado`);
        }
        return ticket;
    }
    async findActivos() {
        return this.ticketRepository.find({
            where: { activo: true },
            order: { fechhaHoraIngreso: 'DESC' },
        });
    }
    async cerrarTicket(id, updateTicketDto, authorization) {
        const ticket = await this.findOne(id);
        if (!ticket.activo) {
            throw new common_1.BadRequestException(`El ticket con id ${id} ya está cerrado`);
        }
        if (updateTicketDto.activo === true) {
            throw new common_1.BadRequestException('No se puede reactivar un ticket. Envíe activo: false para cerrarlo.');
        }
        const fechaSalida = updateTicketDto.fechhaHoraSalida
            ? new Date(updateTicketDto.fechhaHoraSalida)
            : new Date();
        if (Number.isNaN(fechaSalida.getTime())) {
            throw new common_1.BadRequestException('fechhaHoraSalida no es una fecha válida');
        }
        const ingresoDate = this.toDate(ticket.fechhaHoraIngreso);
        if (fechaSalida.getTime() < ingresoDate.getTime()) {
            throw new common_1.BadRequestException('fechhaHoraSalida no puede ser anterior a fechhaHoraIngreso');
        }
        const horas = this.calcularHorasCobro(ticket.fechhaHoraIngreso, fechaSalida);
        const costo = this.calcularCosto(horas);
        ticket.activo = false;
        ticket.fechhaHoraSalida = fechaSalida;
        ticket.valorRecaudo = costo;
        await this.actualizarEstadoEspacio(ticket.idEspacio, 'DISPONIBLE', authorization);
        const closedTicket = await this.ticketRepository.save(ticket);
        this.logger.log(`Ticket con ID ${id} cerrado`);
        return closedTicket;
    }
    async remove(id) {
        const ticket = await this.findOne(id);
        await this.ticketRepository.remove(ticket);
    }
    async validarPersona(dni, authorization) {
        try {
            const url = `${this.personaUrl}/${dni}`;
            return await this.httpClient.get(url, authorization);
        }
        catch (error) {
            this.logger.error(`Error al validar persona ${dni}: ${error}`);
            return null;
        }
    }
    async validarPlaca(placa) {
        try {
            const serviceToken = await this.serviceTokenService.getServiceToken();
            const url = `${this.vehiculosUrl}/placa/${encodeURIComponent(placa)}`;
            return await this.httpClient.get(url, serviceToken);
        }
        catch (error) {
            this.logger.error(`Error al validar placa ${placa}: ${error}`);
            return null;
        }
    }
    async buscarEspacioDisponible(idEspacio, authorization) {
        try {
            const url = `${this.espacioUrl}/${idEspacio}`;
            const espacio = await this.httpClient.get(url, authorization);
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
        }
        catch (error) {
            this.logger.error(`Error al buscar espacio ${idEspacio}: ${error}`);
            return null;
        }
    }
    async validarTicketActivo(placa) {
        return this.ticketRepository.findOne({
            where: { placa, activo: true },
        });
    }
    toDate(fecha) {
        return fecha instanceof Date ? fecha : new Date(fecha);
    }
    calcularHorasCobro(ingreso, salida) {
        const ingresoDate = this.toDate(ingreso);
        const salidaDate = this.toDate(salida);
        const diffMs = salidaDate.getTime() - ingresoDate.getTime();
        if (Number.isNaN(diffMs) || diffMs <= 0) {
            return 1;
        }
        const horasTranscurridas = diffMs / (1000 * 60 * 60);
        return Math.max(1, Math.ceil(horasTranscurridas));
    }
    calcularCosto(horas) {
        return Number((horas * this.tarifaPorHora).toFixed(2));
    }
    async emitirTicket(createTicketDto, espacio, authorization) {
        await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'OCUPADO', authorization);
        const ticket = this.ticketRepository.create({
            placa: createTicketDto.placa,
            dni: createTicketDto.dni,
            idEspacio: createTicketDto.idEspacio,
            nombreZona: espacio.nombreZona ?? espacio.zona ?? '',
            fechhaHoraIngreso: new Date(),
            activo: true,
            valorRecaudo: 0,
        });
        try {
            return await this.ticketRepository.save(ticket);
        }
        catch (error) {
            await this.actualizarEstadoEspacio(createTicketDto.idEspacio, 'DISPONIBLE', authorization);
            throw error;
        }
    }
    async actualizarEstadoEspacio(idEspacio, estado, authorization) {
        const url = `${this.espacioUrl}/${idEspacio}/estado?estado=${estado}`;
        await this.httpClient.put(url, authorization);
    }
};
exports.TicketsService = TicketsService;
exports.TicketsService = TicketsService = TicketsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        htppl_cliente_service_1.HttpClientService,
        config_1.ConfigService,
        service_token_service_1.ServiceTokenService])
], TicketsService);
//# sourceMappingURL=tickets.service.js.map