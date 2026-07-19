import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

describe('TicketsService', () => {
  let service: TicketsService;

  const TENANT = 'tenant-1';

  const repoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const httpClientMock = { get: jest.fn(), put: jest.fn() };
  const serviceTokenMock = { getServiceToken: jest.fn() };
  const publisherMock = { publishEvent: jest.fn() };
  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  const configValues: Record<string, string> = {
    MS_PERSONA: 'http://ms-personas/api/personas',
    MS_ESPACIOS: 'http://ms-zonas/api/espacios',
    MS_VEHICULOS: 'http://ms-vehiculos/api/vehiculos',
    TARIFA_HORA: '2',
  };

  const espacioDisponible = { id: '1', nombre: 'ZON-A-001', estado: 'DISPONIBLE', nombreZona: 'Zona A' };
  const persona = { dni: '1111111111', nombre: 'Juan' };
  const vehiculo = { placa: 'ABC-1234' };

  const createDto = { dni: '1111111111', placa: 'ABC-1234', idEspacio: '1' } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheMock.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: repoMock },
        { provide: HttpClientService, useValue: httpClientMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: string) => configValues[key] ?? def ?? '') },
        },
        { provide: ServiceTokenService, useValue: serviceTokenMock },
        { provide: EventPublisher, useValue: publisherMock },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    beforeEach(() => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('personas')) return Promise.resolve(persona);
        if (url.includes('espacios')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      serviceTokenMock.getServiceToken.mockResolvedValue('service-token');
      httpClientMock.get.mockImplementationOnce((url: string) =>
        url.includes('personas') ? Promise.resolve(persona) : Promise.resolve(null),
      );
    });

    it('crea el ticket cuando persona, placa y espacio son válidos', async () => {
      httpClientMock.get.mockReset();
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue(null);
      const ticketCreado = { id: 't1', placa: 'ABC-1234' };
      repoMock.create.mockReturnValue(ticketCreado);
      repoMock.save.mockResolvedValue(ticketCreado);

      const result = await service.create(createDto, TENANT, 'Bearer token', 'user1', '10.0.0.1');

      expect(result).toBe(ticketCreado);
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT }),
      );
      expect(httpClientMock.put).toHaveBeenCalledWith(
        expect.stringContaining('estado=OCUPADO'),
        'Bearer token',
      );
      expect(publisherMock.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'CREATE', entidad: 'Ticket' }),
      );
    });

    it('lanza BadRequestException si la persona no existe', async () => {
      httpClientMock.get.mockResolvedValue(null);

      await expect(service.create(createDto, TENANT)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la placa no existe', async () => {
      httpClientMock.get.mockImplementation((url: string) =>
        url.includes('/personas/') ? Promise.resolve(persona) : Promise.resolve(null),
      );

      await expect(service.create(createDto, TENANT)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si el espacio no está disponible', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve({ ...espacioDisponible, estado: 'OCUPADO' });
        return Promise.resolve(null);
      });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la placa ya tiene un ticket activo', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue({ id: 'activo', activo: true });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(BadRequestException);
    });
  });

  it('findAll filtra por tenant y emisorUserId cuando se provee', async () => {
    repoMock.find.mockResolvedValue([]);

    await service.findAll(TENANT, 'user1');

    expect(repoMock.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT, emisorUserId: 'user1' },
      order: { fechhaHoraIngreso: 'DESC' },
    });
  });

  describe('findOne', () => {
    it('devuelve el ticket cuando existe', async () => {
      const ticket = { id: '1', emisorUserId: 'user1' };
      repoMock.findOne.mockResolvedValue(ticket);

      await expect(service.findOne('1', TENANT)).resolves.toBe(ticket);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope', TENANT)).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException cuando pertenece a otro usuario', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', emisorUserId: 'otro' });

      await expect(service.findOne('1', TENANT, 'user1')).rejects.toThrow(NotFoundException);
    });
  });

  it('findActivos filtra tickets activos del tenant', async () => {
    repoMock.find.mockResolvedValue([]);

    await service.findActivos(TENANT);

    expect(repoMock.find).toHaveBeenCalledWith({
      where: { activo: true, tenantId: TENANT },
      order: { fechhaHoraIngreso: 'DESC' },
    });
  });

  describe('cerrarTicket', () => {
    const ticketActivo = {
      id: '1',
      activo: true,
      idEspacio: '1',
      fechhaHoraIngreso: new Date('2026-01-01T10:00:00Z'),
    };

    it('cierra el ticket, calcula el costo y publica evento UPDATE', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo });
      repoMock.save.mockImplementation((t) => Promise.resolve(t));

      const result = await service.cerrarTicket(
        '1',
        { fechhaHoraSalida: '2026-01-01T12:30:00Z' } as any,
        TENANT,
        'Bearer token',
        'cobrador1',
        '10.0.0.1',
      );

      expect(result.activo).toBe(false);
      expect(result.valorRecaudo).toBe(6);
      expect(httpClientMock.put).toHaveBeenCalledWith(
        expect.stringContaining('estado=DISPONIBLE'),
        'Bearer token',
      );
      expect(publisherMock.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'UPDATE' }),
      );
    });

    it('lanza BadRequestException si el ticket ya está cerrado', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, activo: false });

      await expect(
        service.cerrarTicket('1', {} as any, TENANT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si se intenta reactivar el ticket', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo });

      await expect(
        service.cerrarTicket('1', { activo: true } as any, TENANT),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si fechhaHoraSalida es anterior al ingreso', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo });

      await expect(
        service.cerrarTicket('1', { fechhaHoraSalida: '2025-01-01T00:00:00Z' } as any, TENANT),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('remove elimina el ticket y publica evento DELETE', async () => {
    const ticket = { id: '1' };
    repoMock.findOne.mockResolvedValue(ticket);

    await service.remove('1', TENANT, 'user1', '10.0.0.1');

    expect(repoMock.remove).toHaveBeenCalledWith(ticket);
    expect(publisherMock.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'DELETE' }),
    );
  });
});
