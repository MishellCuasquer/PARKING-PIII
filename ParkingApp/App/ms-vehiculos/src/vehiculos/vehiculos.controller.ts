import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

// Sin @ApiBearerAuth() Swagger UI no adjunta el token al pulsar "Try it out":
// el botón "Authorize" lo guarda, pero cada endpoint necesita declarar que
// exige el esquema bearer para que la petición salga con el header puesto.
@ApiBearerAuth()
@Controller('vehiculos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  /**
   * Tenant efectivo de la petición:
   * - Cuenta SERVICE (sin tenant propio): debe traer el header X-Tenant-Id
   *   con el tenant del usuario original (lo propaga ms-tickets).
   * - Usuario normal: el claim tenantId del JWT.
   *
   * Si un usuario normal manda un tenant distinto al de su token (por cabecera
   * o por query) la petición se rechaza con 403. Antes se descartaba en
   * silencio: no había fuga de datos, pero un intento de saltar de empresa
   * respondía 200 y quedaba indistinguible de una petición legítima.
   */
  private resolveTenantId(req): string | null {
    const roles: string[] = req.user?.roles ?? [];
    if (roles.includes('SERVICE')) {
      const header = req.headers['x-tenant-id'] as string;
      if (!header) {
        throw new BadRequestException(
          'Las llamadas de servicio requieren el header X-Tenant-Id',
        );
      }
      return header;
    }

    const tenantDelToken: string | null = req.user?.tenantId ?? null;
    const solicitado =
      (req.headers['x-tenant-id'] as string) || (req.query?.tenant as string) || null;

    if (solicitado && solicitado !== tenantDelToken) {
      throw new ForbiddenException(
        'El tenant solicitado no coincide con el de la sesión',
      );
    }
    return tenantDelToken;
  }

  private clientIp(req): string {
    const ip = req.headers['x-forwarded-for'] as string ||
               req.headers['x-real-ip'] as string ||
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    return ip.includes(',') ? ip.split(',')[0].trim() : ip;
  }

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  create(@Body() createVehiculoDto: CreateVehiculoDto, @Request() req) {
    const userId = req.user?.userId || 'system';
    return this.vehiculosService.create(
      createVehiculoDto,
      this.resolveTenantId(req),
      userId,
      this.clientIp(req),
    );
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  findAll(@Request() req) {
    return this.vehiculosService.findAll(this.resolveTenantId(req));
  }

  @Get('placa/:placa')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT', 'SERVICE')
  findByPlaca(@Param('placa') placa: string, @Request() req) {
    return this.vehiculosService.findByPlaca(placa, this.resolveTenantId(req));
  }

  /**
   * Autocompletado del formulario: busca la placa en todas las empresas y
   * devuelve solo las características del vehículo (sin id, tenant ni dueño).
   */
  @Get('consulta-placa/:placa')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  consultarPlaca(@Param('placa') placa: string) {
    return this.vehiculosService.consultarPlacaGlobal(placa);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  findOne(@Param('id') id: string, @Request() req) {
    return this.vehiculosService.findOne(id, this.resolveTenantId(req));
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  update(@Param('id') id: string, @Body() updateVehiculoDto: UpdateVehiculoDto, @Request() req) {
    const userId = req.user?.userId || 'system';
    return this.vehiculosService.update(
      id,
      updateVehiculoDto,
      this.resolveTenantId(req),
      userId,
      this.clientIp(req),
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user?.userId || 'system';
    return this.vehiculosService.remove(
      id,
      this.resolveTenantId(req),
      userId,
      this.clientIp(req),
    );
  }
}
