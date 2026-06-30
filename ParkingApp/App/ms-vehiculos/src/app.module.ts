import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { databaseConfig } from './config/database.config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(databaseConfig),
    AuthModule,
    VehiculosModule,
  ],
})
export class AppModule {}
