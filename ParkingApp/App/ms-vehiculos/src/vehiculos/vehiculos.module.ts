import { Module } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehiculo } from './entities/vehiculo.entity';
import { Auto } from './entities/auto.entity';
import { Motocicleta } from './entities/motocicleta.entity';
import { Camioneta } from './entities/camioneta.entity';
import { AuthModule } from '../auth/auth.module';
import { EventPublisher } from '../common/event-publisher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehiculo, Auto, Motocicleta, Camioneta]),
    AuthModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService, EventPublisher],
  exports: [VehiculosService, EventPublisher],
})
export class VehiculosModule {}