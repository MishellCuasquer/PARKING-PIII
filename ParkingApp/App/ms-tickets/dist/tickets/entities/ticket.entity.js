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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ticket = void 0;
const typeorm_1 = require("typeorm");
const swagger_1 = require("@nestjs/swagger");
let Ticket = class Ticket {
    id;
    placa;
    dni;
    idEspacio;
    nombreZona;
    fechhaHoraIngreso;
    fechhaHoraSalida;
    activo;
    valorRecaudo;
    createdAt;
    updatedAt;
};
exports.Ticket = Ticket;
__decorate([
    (0, swagger_1.ApiProperty)({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Ticket.prototype, "id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'ABC-1234' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "placa", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '0604052068' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "dni", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '123e4567-e89b-12d3-a456-426614174001' }),
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Ticket.prototype, "idEspacio", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Zona VIP' }),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Ticket.prototype, "nombreZona", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Ticket.prototype, "fechhaHoraIngreso", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Ticket.prototype, "fechhaHoraSalida", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Ticket.prototype, "activo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 0 }),
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Ticket.prototype, "valorRecaudo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Ticket.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Ticket.prototype, "updatedAt", void 0);
exports.Ticket = Ticket = __decorate([
    (0, typeorm_1.Entity)('Tickets')
], Ticket);
//# sourceMappingURL=ticket.entity.js.map