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

  @Post()
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Emitir un nuevo ticket de ingreso' })
  @ApiResponse({ status: 201, description: 'Ticket creado', type: Ticket })
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.create(createTicketDto, authorization);
  }

  @Get()
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Listar todos los tickets' })
  findAll() {
    return this.ticketsService.findAll();
  }

  @Get('activos')
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Listar tickets activos' })
  findActivos() {
    return this.ticketsService.findActivos();
  }

  @Get(':id')
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Obtener un ticket por ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  @Patch(':id/cerrar')
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Cerrar un ticket y liberar el espacio' })
  cerrarTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.cerrarTicket(id, updateTicketDto, authorization);
  }

  @Patch(':id')
  @Put(':id')
  @Roles('ADMIN', 'CLIENT')
  @ApiOperation({ summary: 'Cerrar un ticket (PATCH/PUT sobre el ID del ticket)' })
  @ApiResponse({ status: 200, description: 'Ticket cerrado', type: Ticket })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTicketDto: UpdateTicketDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.ticketsService.cerrarTicket(id, updateTicketDto, authorization);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un ticket' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.remove(id);
  }
}
