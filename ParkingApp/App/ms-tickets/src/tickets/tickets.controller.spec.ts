import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let ticketsService: TicketsService;

  const TENANT = 'tenant-1';

  const makeReq = (overrides: any = {}) => ({
    user: { userId: 'user1', roles: ['CLIENT'], tenantId: TENANT },
    headers: {},
    socket: { remoteAddress: '10.0.0.5' },
    ...overrides,
  });

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
        {
          provide: CacheService,
          useValue: { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
    ticketsService = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create pasa el userId y la IP al servicio', async () => {
    jest.spyOn(ticketsService, 'create').mockResolvedValue({ id: '1' } as any);
    const dto = { placa: 'ABC-1234' } as any;

    await controller.create(dto, makeReq(), 'Bearer token');

    expect(ticketsService.create).toHaveBeenCalledWith(dto, TENANT, 'Bearer token', 'user1', '10.0.0.5');
  });

  it('findAll no filtra por usuario cuando el rol es ADMIN', async () => {
    jest.spyOn(ticketsService, 'findAll').mockResolvedValue([]);

    await controller.findAll(makeReq({ user: { userId: 'admin1', roles: ['ADMIN'], tenantId: TENANT } }));

    expect(ticketsService.findAll).toHaveBeenCalledWith(TENANT, undefined);
  });

  it('findAll filtra por el propio usuario cuando el rol es CLIENT', async () => {
    jest.spyOn(ticketsService, 'findAll').mockResolvedValue([]);

    await controller.findAll(makeReq());

    expect(ticketsService.findAll).toHaveBeenCalledWith(TENANT, 'user1');
  });

  it('findActivos delega en el servicio con el filtro de dueño', async () => {
    jest.spyOn(ticketsService, 'findActivos').mockResolvedValue([]);

    await controller.findActivos(makeReq());

    expect(ticketsService.findActivos).toHaveBeenCalledWith(TENANT, 'user1');
  });

  it('findOne delega en el servicio', async () => {
    jest.spyOn(ticketsService, 'findOne').mockResolvedValue({ id: '1' } as any);

    await controller.findOne('1', makeReq());

    expect(ticketsService.findOne).toHaveBeenCalledWith('1', TENANT, 'user1');
  });

  it('cerrarTicket pasa tenant, usuario e IP al servicio', async () => {
    jest.spyOn(ticketsService, 'cerrarTicket').mockResolvedValue({ id: '1' } as any);
    const dto = { activo: false } as any;

    await controller.cerrarTicket('1', dto, makeReq(), 'Bearer token');

    expect(ticketsService.cerrarTicket).toHaveBeenCalledWith(
      '1',
      dto,
      TENANT,
      'Bearer token',
      'user1',
      '10.0.0.5',
    );
  });

  it('update delega en cerrarTicket con los mismos parámetros', async () => {
    jest.spyOn(ticketsService, 'cerrarTicket').mockResolvedValue({ id: '1' } as any);
    const dto = { activo: false } as any;

    await controller.update('1', dto, makeReq(), 'Bearer token');

    expect(ticketsService.cerrarTicket).toHaveBeenCalledWith(
      '1',
      dto,
      TENANT,
      'Bearer token',
      'user1',
      '10.0.0.5',
    );
  });

  it('remove delega en el servicio', async () => {
    jest.spyOn(ticketsService, 'remove').mockResolvedValue(undefined);

    await controller.remove('1', makeReq());

    expect(ticketsService.remove).toHaveBeenCalledWith('1', TENANT, 'user1', '10.0.0.5');
  });

  it('toma la primera IP de x-forwarded-for', async () => {
    jest.spyOn(ticketsService, 'create').mockResolvedValue({ id: '1' } as any);
    const req = makeReq({ headers: { 'x-forwarded-for': '200.1.1.1, 10.0.0.2' } });

    await controller.create({ placa: 'ABC-1234' } as any, req);

    expect(ticketsService.create).toHaveBeenCalledWith(
      { placa: 'ABC-1234' },
      TENANT,
      undefined,
      'user1',
      '200.1.1.1',
    );
  });
});
