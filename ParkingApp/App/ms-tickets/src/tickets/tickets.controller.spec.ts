import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { EventPublisher } from '../common/event-publisher.service';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: {} },
        { provide: HttpClientService, useValue: { get: jest.fn(), put: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, def?: string) => def ?? '') },
        },
        { provide: ServiceTokenService, useValue: { getServiceToken: jest.fn() } },
        { provide: EventPublisher, useValue: { publishEvent: jest.fn() } },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
