import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './entities/ticket.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // CLIENT solo ve/opera sobre sus propios tickets; ADMIN/OPERATOR ven todos.
  private ownerFilter(req: any): string | undefined {
    const roles: string[] = req.user?.roles ?? [];
    if (roles.includes('ADMIN') || roles.includes('OPERATOR')) {
      return undefined;
    }
    return req.user?.userId;
  }

  private clientIp(req: any): string {
    const ip =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      req.ip ||
      '127.0.0.1';
    return ip.includes(',') ? ip.split(',')[0].trim() : ip;
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  @ApiOperation({ summary: 'Emitir un nuevo ticket de ingreso' })
  @ApiResponse({ status: 201, description: 'Ticket creado', type: Ticket })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Request() req: any,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.create(createTicketDto, authorization, req.user?.userId, this.clientIp(req));
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  @ApiOperation({ summary: 'Listar todos los tickets' })
  findAll(@Request() req: any) {
    return this.ticketsService.findAll(this.ownerFilter(req));
  }

  @Get('activos')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  @ApiOperation({ summary: 'Listar tickets activos' })
  findActivos(@Request() req: any) {
    return this.ticketsService.findActivos(this.ownerFilter(req));
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  @ApiOperation({ summary: 'Obtener un ticket por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.ticketsService.findOne(id, this.ownerFilter(req));
  }

  @Patch(':id/cerrar')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Cerrar (cobrar) un ticket y liberar el espacio' })
  cerrarTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req: any,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.cerrarTicket(
      id,
      updateTicketDto,
      authorization,
      req.user?.userId,
      this.clientIp(req),
    );
  }

  @Patch(':id')
  @Put(':id')
  @Roles('ADMIN', 'OPERATOR')
  @ApiOperation({ summary: 'Cerrar un ticket (PATCH/PUT sobre el ID del ticket)' })
  @ApiResponse({ status: 200, description: 'Ticket cerrado', type: Ticket })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Request() req: any,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.cerrarTicket(
      id,
      updateTicketDto,
      authorization,
      req.user?.userId,
      this.clientIp(req),
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un ticket' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.ticketsService.remove(id, req.user?.userId, this.clientIp(req));
  }
}
