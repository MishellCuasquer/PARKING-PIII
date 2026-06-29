import { ConfigService } from '@nestjs/config';
export declare class ServiceTokenService {
    private readonly configService;
    private readonly logger;
    private cachedToken;
    private tokenExpiresAt;
    constructor(configService: ConfigService);
    getServiceToken(): Promise<string>;
}
