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

  @Post()
  @Roles('ADMIN', 'OPERATOR', 'CLIENT')
  create(@Body() createVehiculoDto: CreateVehiculoDto, @Request() req) {
    const userId = req.user?.userId || 'system';
    // Obtener IP real del cliente (considerando proxies)
    const ip = req.headers['x-forwarded-for'] as string ||
               req.headers['x-real-ip'] as string ||
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    // Si hay múltiples IPs en x-forwarded-for, tomar la primera
    const clientIp = ip.includes(',') ? ip.split(',')[0].trim() : ip;
    return this.vehiculosService.create(createVehiculoDto, userId, clientIp);
  }

  @Get()
  @Roles('ADMIN', 'OPERATOR')
  findAll() {
    return this.vehiculosService.findAll();
  }

  @Get('placa/:placa')
  @Roles('ADMIN', 'OPERATOR', 'CLIENT', 'SERVICE')
  findByPlaca(@Param('placa') placa: string) {
    return this.vehiculosService.findByPlaca(placa);
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERATOR')
  findOne(@Param('id') id: string) {
    return this.vehiculosService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @Body() updateVehiculoDto: UpdateVehiculoDto, @Request() req) {
    const userId = req.user?.userId || 'system';
    const ip = req.headers['x-forwarded-for'] as string ||
               req.headers['x-real-ip'] as string ||
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    const clientIp = ip.includes(',') ? ip.split(',')[0].trim() : ip;
    return this.vehiculosService.update(id, updateVehiculoDto, userId, clientIp);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @Request() req) {
    const userId = req.user?.userId || 'system';
    const ip = req.headers['x-forwarded-for'] as string ||
               req.headers['x-real-ip'] as string ||
               req.socket.remoteAddress ||
               req.ip ||
               '127.0.0.1';
    const clientIp = ip.includes(',') ? ip.split(',')[0].trim() : ip;
    return this.vehiculosService.remove(id, userId, clientIp);
  }
}
