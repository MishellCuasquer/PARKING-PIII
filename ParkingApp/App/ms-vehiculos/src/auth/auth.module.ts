import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'miClaveSecretaSuperSeguraParaJWT123456789',
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [JwtStrategy, RolesGuard],
  exports: [PassportModule, JwtModule, RolesGuard],
})
export class AuthModule {}
