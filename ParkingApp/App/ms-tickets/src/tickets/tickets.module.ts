import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpClientService } from '../common/htppl-cliente.service';
import { Ticket } from './entities/ticket.entity';
import { AuthModule } from '../auth/auth.module';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';
import { TenantConfigService } from '../common/tenant-config.service';
import { OutboxEvent } from '../common/entities/outbox-event.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, OutboxEvent]), AuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    HttpClientService,
    EventPublisher,
    CacheService,
    TenantConfigService,
  ],
})
export class TicketsModule {}
