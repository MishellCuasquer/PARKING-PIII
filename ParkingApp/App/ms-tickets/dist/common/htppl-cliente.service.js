"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpClientService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpClientService = void 0;
const common_1 = require("@nestjs/common");
let HttpClientService = HttpClientService_1 = class HttpClientService {
    logger = new common_1.Logger(HttpClientService_1.name);
    async get(url, authHeader) {
        const response = await fetch(url, {
            headers: this.buildHeaders(authHeader),
        });
        if (!response.ok) {
            this.logger.error(`GET ${url} failed: ${response.status} ${response.statusText}`);
            throw new Error(`Error fetching ${url}: ${response.statusText}`);
        }
        return response.json();
    }
    async post(url, body, authHeader) {
        const response = await fetch(url, {
            method: 'POST',
            headers: this.buildHeaders(authHeader),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`POST ${url} failed: ${response.statusText}`);
        }
        return response.json();
    }
    async put(url, authHeader) {
        const response = await fetch(url, {
            method: 'PUT',
            headers: this.buildHeaders(authHeader),
        });
        if (!response.ok) {
            this.logger.error(`PUT ${url} failed: ${response.status} ${response.statusText}`);
            throw new Error(`Error updating ${url}: ${response.statusText}`);
        }
        return response.json();
    }
    buildHeaders(authHeader) {
        const headers = { 'Content-Type': 'application/json' };
        if (authHeader) {
            headers.Authorization = authHeader.startsWith('Bearer ')
                ? authHeader
                : `Bearer ${authHeader}`;
        }
        return headers;
    }
};
exports.HttpClientService = HttpClientService;
exports.HttpClientService = HttpClientService = HttpClientService_1 = __decorate([
    (0, common_1.Injectable)()
], HttpClientService);
//# sourceMappingURL=htppl-cliente.service.js.map