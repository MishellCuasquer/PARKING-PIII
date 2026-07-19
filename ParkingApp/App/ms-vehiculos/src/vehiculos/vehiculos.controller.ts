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
} from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('vehiculos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  /**
   * Tenant efectivo de la petición:
   * - Cuenta SERVICE (sin tenant propio): debe traer el header X-Tenant-Id
   *   con el tenant del usuario original (lo propaga ms-tickets).
   * - Usuario normal: el claim tenantId del JWT (el header se ignora, no es falsificable).
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
    return req.user?.tenantId ?? null;
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
