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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tickets_service_1 = require("./tickets.service");
const create_ticket_dto_1 = require("./dto/create-ticket.dto");
const update_ticket_dto_1 = require("./dto/update-ticket.dto");
const ticket_entity_1 = require("./entities/ticket.entity");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
let TicketsController = class TicketsController {
    ticketsService;
    constructor(ticketsService) {
        this.ticketsService = ticketsService;
    }
    create(createTicketDto, authorization) {
        return this.ticketsService.create(createTicketDto, authorization);
    }
    findAll() {
        return this.ticketsService.findAll();
    }
    findActivos() {
        return this.ticketsService.findActivos();
    }
    findOne(id) {
        return this.ticketsService.findOne(id);
    }
    cerrarTicket(id, updateTicketDto, authorization) {
        return this.ticketsService.cerrarTicket(id, updateTicketDto, authorization);
    }
    update(id, updateTicketDto, authorization) {
        return this.ticketsService.cerrarTicket(id, updateTicketDto, authorization);
    }
    remove(id) {
        return this.ticketsService.remove(id);
    }
};
exports.TicketsController = TicketsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Emitir un nuevo ticket de ingreso' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Ticket creado', type: ticket_entity_1.Ticket }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_ticket_dto_1.CreateTicketDto, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar todos los tickets' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('activos'),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Listar tickets activos' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "findActivos", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener un ticket por ID' }),
    (0, swagger_1.ApiParam)({ name: 'id', type: 'string', format: 'uuid' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/cerrar'),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Cerrar un ticket y liberar el espacio' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ticket_dto_1.UpdateTicketDto, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "cerrarTicket", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN', 'CLIENT'),
    (0, swagger_1.ApiOperation)({ summary: 'Cerrar un ticket (PATCH/PUT sobre el ID del ticket)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Ticket cerrado', type: ticket_entity_1.Ticket }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_ticket_dto_1.UpdateTicketDto, String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar un ticket' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], TicketsController.prototype, "remove", null);
exports.TicketsController = TicketsController = __decorate([
    (0, swagger_1.ApiTags)('Tickets'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('tickets'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [tickets_service_1.TicketsService])
], TicketsController);
//# sourceMappingURL=tickets.controller.js.map