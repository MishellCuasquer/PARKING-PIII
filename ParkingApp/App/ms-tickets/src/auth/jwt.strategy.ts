import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  userId: string;
  roles: string[];
  tenantId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SECRET',
        'miClaveSecretaSuperSeguraParaJWT123456789',
      ),
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.userId,
      username: payload.sub,
      roles: payload.roles ?? [],
      tenantId: payload.tenantId ?? null,
    };
  }
}
