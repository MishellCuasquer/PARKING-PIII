"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ServiceTokenService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceTokenService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let ServiceTokenService = ServiceTokenService_1 = class ServiceTokenService {
    configService;
    logger = new common_1.Logger(ServiceTokenService_1.name);
    cachedToken = null;
    tokenExpiresAt = 0;
    constructor(configService) {
        this.configService = configService;
    }
    async getServiceToken() {
        if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
            return this.cachedToken;
        }
        const authUrl = this.configService.get('AUTH_TOKEN_URL', 'http://localhost:8080/api/oauth/token');
        const username = this.configService.get('SERVICE_USERNAME', 'service');
        const password = this.configService.get('SERVICE_PASSWORD', 'service123');
        const response = await fetch(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'password',
                username,
                password,
            }),
        });
        if (!response.ok) {
            this.logger.error(`No se pudo obtener token de servicio: ${response.statusText}`);
            throw new Error('Error al obtener token de servicio');
        }
        const data = (await response.json());
        this.cachedToken = data.access_token;
        this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000;
        return this.cachedToken;
    }
};
exports.ServiceTokenService = ServiceTokenService;
exports.ServiceTokenService = ServiceTokenService = ServiceTokenService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ServiceTokenService);
//# sourceMappingURL=service-token.service.js.map