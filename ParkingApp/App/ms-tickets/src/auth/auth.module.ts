import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { ServiceTokenService } from './service-token.service';

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
  providers: [JwtStrategy, RolesGuard, ServiceTokenService],
  exports: [PassportModule, JwtModule, RolesGuard, ServiceTokenService],
})
export class AuthModule {}
