import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Vehiculo } from '../vehiculos/entities/vehiculo.entity';
import { Auto } from '../vehiculos/entities/auto.entity';
import { Motocicleta } from '../vehiculos/entities/motocicleta.entity';
import { Camioneta } from '../vehiculos/entities/camioneta.entity';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USUARIO ?? 'postgres',
  password: process.env.DB_CONTRASENA ?? '123',
  database: process.env.DB_NOMBRE ?? 'vehiculos_db',
  entities: [Vehiculo, Auto, Motocicleta, Camioneta],
  synchronize: true, // Solo desarrollo
  logging: true,
};