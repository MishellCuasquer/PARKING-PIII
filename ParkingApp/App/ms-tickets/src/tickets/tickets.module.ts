import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpClientService } from '../common/htppl-cliente.service';
import { Ticket } from './entities/ticket.entity';
import { AuthModule } from '../auth/auth.module';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService, HttpClientService, EventPublisher, CacheService],
})
export class TicketsModule {}
