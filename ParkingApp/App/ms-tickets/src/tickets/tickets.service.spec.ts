import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { HttpClientService, UpstreamHttpError } from '../common/htppl-cliente.service';
import { ServiceTokenService } from '../auth/service-token.service';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';
import { TenantConfigService } from '../common/tenant-config.service';

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
  // La tarifa ya no sale del entorno sino de la configuración de la empresa.
  // La plataforma opera en dólares: 2.00 USD/h es el mismo valor que tenía
  // TARIFA_HORA, así que las aserciones de importe de los tests existentes
  // siguen valiendo.
  const tenantConfigMock = { getTarifaHora: jest.fn(), getConfig: jest.fn() };

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
    tenantConfigMock.getTarifaHora.mockResolvedValue(2);
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
        { provide: TenantConfigService, useValue: tenantConfigMock },
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

    // Compatibilidad vehículo <-> espacio: un auto no cabe en una plaza de moto.
    const prepararCreate = (vehiculoMock: any, espacioMock: any) => {
      httpClientMock.get.mockReset();
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculoMock);
        if (url.includes('/espacios/')) return Promise.resolve(espacioMock);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue(null);
      repoMock.create.mockReturnValue({ id: 't1' });
      repoMock.save.mockResolvedValue({ id: 't1' });
    };

    it('rechaza meter un auto en un espacio de moto', async () => {
      prepararCreate(
        { placa: 'ABC-1234', tipo: 'auto' },
        { ...espacioDisponible, tipoEspacio: 'MOTO' },
      );

      await expect(service.create(createDto, TENANT, 'Bearer token')).rejects.toThrow(
        BadRequestException,
      );
      // El espacio no debe quedar ocupado por un intento inválido
      expect(httpClientMock.put).not.toHaveBeenCalled();
    });

    it('rechaza meter una moto en un espacio de auto', async () => {
      prepararCreate(
        { placa: 'AB-1234', tipo: 'moto' },
        { ...espacioDisponible, tipoEspacio: 'AUTO' },
      );

      await expect(service.create(createDto, TENANT, 'Bearer token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('permite un auto en un espacio de auto', async () => {
      prepararCreate(
        { placa: 'ABC-1234', tipo: 'auto' },
        { ...espacioDisponible, tipoEspacio: 'AUTO' },
      );

      await expect(service.create(createDto, TENANT, 'Bearer token')).resolves.toBeDefined();
    });

    // Una camioneta cabe tanto en plaza de auto como de camión.
    it.each([['AUTO'], ['CAMION']])(
      'permite una camioneta en un espacio %s',
      async (tipoEspacio) => {
        prepararCreate(
          { placa: 'ABC-1234', tipo: 'camioneta' },
          { ...espacioDisponible, tipoEspacio },
        );

        await expect(service.create(createDto, TENANT, 'Bearer token')).resolves.toBeDefined();
      },
    );

    // Datos anteriores a que se expusiera tipoEspacio: no se puede bloquear a
    // vehículos ya registrados por un campo que antes no existía.
    it('deja pasar cuando el espacio no declara tipo', async () => {
      prepararCreate({ placa: 'ABC-1234', tipo: 'auto' }, { ...espacioDisponible });

      await expect(service.create(createDto, TENANT, 'Bearer token')).resolves.toBeDefined();
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

    /**
     * Escenario 3/8: quien decide si la plaza está libre es ms-zonas, de forma
     * atómica y bajo bloqueo. Un 409 suyo se propaga como 409 al operador, con
     * el motivo real (ocupado, mantenimiento…) en el mensaje.
     */
    it('propaga como 409 el rechazo de ms-zonas al ocupar el espacio', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue(null);
      // Once: el rechazo es de este caso y no debe filtrarse a los demás tests
      const rechazo = new UpstreamHttpError(
        409,
        'El espacio no está disponible (estado: mantenimiento)',
        '/espacios',
      );
      httpClientMock.put.mockRejectedValueOnce(rechazo).mockRejectedValueOnce(rechazo);

      await expect(service.create(createDto, TENANT)).rejects.toThrow(ConflictException);
      await expect(service.create(createDto, TENANT)).rejects.toThrow(/mantenimiento/);
      // El ticket no llega a persistirse
      expect(repoMock.save).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si la placa ya tiene un ticket activo', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue({ id: 'activo', activo: true, tenantId: TENANT });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(ConflictException);
    });

    /**
     * Escenario 1: el rechazo por duplicado ocurre ANTES de ocupar el espacio.
     * Si se comprobara después, la plaza quedaría ocupada por un ticket que no
     * llegó a existir.
     */
    it('no ocupa el espacio cuando rechaza un ticket duplicado', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      repoMock.findOne.mockResolvedValue({ id: 'activo', activo: true, tenantId: TENANT });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(ConflictException);

      expect(httpClientMock.put).not.toHaveBeenCalled();
      expect(repoMock.save).not.toHaveBeenCalled();
      expect(publisherMock.publishEvent).not.toHaveBeenCalled();
    });

    it('rechaza el ingreso si el vehículo está dentro de otro parqueadero', async () => {
      httpClientMock.get.mockImplementation((url: string) => {
        if (url.includes('/personas/')) return Promise.resolve(persona);
        if (url.includes('/vehiculos')) return Promise.resolve(vehiculo);
        if (url.includes('/espacios/')) return Promise.resolve(espacioDisponible);
        return Promise.resolve(null);
      });
      // Ticket activo de la misma placa pero en OTRA empresa
      repoMock.findOne.mockResolvedValue({ id: 'activo', activo: true, tenantId: 'otro-tenant' });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(
        /está dentro de otro parqueadero/,
      );
      // El ticket activo se busca sin filtrar por empresa
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { placa: createDto.placa, activo: true },
      });
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
      // 2 h 30 min a 2.00 USD/h = 5.00 (la fracción se cobra proporcional)
      expect(result.valorRecaudo).toBe(5);
      expect(httpClientMock.put).toHaveBeenCalledWith(
        expect.stringContaining('estado=DISPONIBLE'),
        'Bearer token',
      );
      expect(publisherMock.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'UPDATE' }),
      );
    });

    // --- Cobro proporcional de la fracción, a 1.00 USD/h ---
    // Quien se queda hora y media paga hora y media, no dos horas.
    it.each([
      ['1 hora exacta', '2026-01-01T11:00:00Z', 1],
      ['1 hora y media', '2026-01-01T11:30:00Z', 1.5],
      ['1 hora y cuarto', '2026-01-01T11:15:00Z', 1.25],
      ['2 horas y media', '2026-01-01T12:30:00Z', 2.5],
      ['3 horas y 20 min', '2026-01-01T13:20:00Z', 3.33],
    ])('cobra %s de forma proporcional', async (_caso, salida, esperado) => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, tenantId: TENANT });
      repoMock.save.mockImplementation((t) => Promise.resolve(t));
      tenantConfigMock.getTarifaHora.mockResolvedValue(1);

      const result = await service.cerrarTicket(
        '1',
        { fechhaHoraSalida: salida } as any,
        TENANT,
        'Bearer token',
        'cobrador1',
      );

      expect(result.valorRecaudo).toBe(esperado);
    });

    // Tarifa mínima: una estancia corta paga la hora completa igualmente.
    it('aplica el mínimo de 1 hora en estancias de pocos minutos', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, tenantId: TENANT });
      repoMock.save.mockImplementation((t) => Promise.resolve(t));
      tenantConfigMock.getTarifaHora.mockResolvedValue(1);

      const result = await service.cerrarTicket(
        '1',
        { fechhaHoraSalida: '2026-01-01T10:10:00Z' } as any,
        TENANT,
        'Bearer token',
        'cobrador1',
      );

      expect(result.valorRecaudo).toBe(1);
    });

    // El corazón del modelo SaaS: la misma infraestructura, dos precios.
    it('cobra según la tarifa de la empresa dueña del ticket, no una global', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, tenantId: 'empresa-cara' });
      repoMock.save.mockImplementation((t) => Promise.resolve(t));
      tenantConfigMock.getTarifaHora.mockResolvedValue(5);

      const result = await service.cerrarTicket(
        '1',
        { fechhaHoraSalida: '2026-01-01T12:30:00Z' } as any,
        'empresa-cara',
        'Bearer token',
        'cobrador1',
      );

      // 2 h 30 min x 5.00 USD/h = 12.50 (con tarifa 2.00 serían 5.00)
      expect(result.valorRecaudo).toBe(12.5);
      expect(tenantConfigMock.getTarifaHora).toHaveBeenCalledWith('empresa-cara');
    });

    it('usa la tarifa de respaldo cuando el ticket no tiene empresa (datos legacy)', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, tenantId: null });
      repoMock.save.mockImplementation((t) => Promise.resolve(t));

      await service.cerrarTicket(
        '1',
        { fechhaHoraSalida: '2026-01-01T12:30:00Z' } as any,
        null,
        'Bearer token',
        'cobrador1',
      );

      expect(tenantConfigMock.getTarifaHora).toHaveBeenCalledWith(null);
    });

    /**
     * Escenario 2: el doble cierre se detecta antes de liberar el espacio y de
     * publicar el evento, así que no hay doble liberación ni auditoría duplicada.
     */
    it('lanza ConflictException si el ticket ya está cerrado', async () => {
      repoMock.findOne.mockResolvedValue({ ...ticketActivo, activo: false });

      await expect(
        service.cerrarTicket('1', {} as any, TENANT),
      ).rejects.toThrow(ConflictException);

      expect(httpClientMock.put).not.toHaveBeenCalled();
      expect(repoMock.save).not.toHaveBeenCalled();
      expect(publisherMock.publishEvent).not.toHaveBeenCalled();
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
