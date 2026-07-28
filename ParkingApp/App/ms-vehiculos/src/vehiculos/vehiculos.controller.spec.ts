import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

describe('VehiculosController', () => {
  let controller: VehiculosController;

  const TENANT = 'tenant-1';

  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPlaca: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const makeReq = (overrides: any = {}) => ({
    user: { userId: 'user1', roles: ['ADMIN'], tenantId: TENANT },
    headers: {},
    socket: { remoteAddress: '10.0.0.5' },
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiculosController],
      providers: [{ provide: VehiculosService, useValue: serviceMock }],
    }).compile();

    controller = module.get<VehiculosController>(VehiculosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create pasa tenant, usuario e IP del socket al servicio', async () => {
    const dto = { tipo: 'auto' } as any;
    serviceMock.create.mockResolvedValue({ id: '1' });

    await controller.create(dto, makeReq());

    expect(serviceMock.create).toHaveBeenCalledWith(dto, TENANT, 'user1', '10.0.0.5');
  });

  it('create toma la primera IP de x-forwarded-for', async () => {
    const dto = { tipo: 'auto' } as any;
    const req = makeReq({
      headers: { 'x-forwarded-for': '200.1.1.1, 10.0.0.2' },
    });

    await controller.create(dto, req);

    expect(serviceMock.create).toHaveBeenCalledWith(dto, TENANT, 'user1', '200.1.1.1');
  });

  it('create usa "system" cuando no hay usuario autenticado', async () => {
    const dto = { tipo: 'auto' } as any;

    await controller.create(dto, makeReq({ user: undefined }));

    expect(serviceMock.create).toHaveBeenCalledWith(dto, null, 'system', '10.0.0.5');
  });

  it('findAll delega en el servicio con el tenant del token', async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await expect(controller.findAll(makeReq())).resolves.toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalledWith(TENANT);
  });

  it('findOne delega en el servicio', async () => {
    serviceMock.findOne.mockResolvedValue({ id: '1' });

    await expect(controller.findOne('1', makeReq())).resolves.toEqual({ id: '1' });
    expect(serviceMock.findOne).toHaveBeenCalledWith('1', TENANT);
  });

  it('findByPlaca delega en el servicio', async () => {
    serviceMock.findByPlaca.mockResolvedValue({ placa: 'ABC-1234' });

    await expect(controller.findByPlaca('ABC-1234', makeReq())).resolves.toEqual({
      placa: 'ABC-1234',
    });
    expect(serviceMock.findByPlaca).toHaveBeenCalledWith('ABC-1234', TENANT);
  });

  it('rol SERVICE usa el header X-Tenant-Id como tenant', async () => {
    serviceMock.findByPlaca.mockResolvedValue({ placa: 'ABC-1234' });
    const req = makeReq({
      user: { userId: 'svc', roles: ['SERVICE'] },
      headers: { 'x-tenant-id': 'tenant-2' },
    });

    await controller.findByPlaca('ABC-1234', req);

    expect(serviceMock.findByPlaca).toHaveBeenCalledWith('ABC-1234', 'tenant-2');
  });

  it('rol SERVICE sin X-Tenant-Id recibe BadRequest', () => {
    const req = makeReq({ user: { userId: 'svc', roles: ['SERVICE'] } });

    expect(() => controller.findByPlaca('ABC-1234', req)).toThrow(
      BadRequestException,
    );
  });

  /**
   * Escenario 4: el tenant sale del claim del JWT. Una cabecera que lo
   * contradice se rechaza con 403 en vez de ignorarse en silencio, para que un
   * intento de saltar de empresa no responda 200.
   */
  it('rechaza con 403 un X-Tenant-Id distinto al del token', () => {
    const req = makeReq({ headers: { 'x-tenant-id': 'tenant-ajeno' } });

    expect(() => controller.findAll(req)).toThrow(ForbiddenException);
    expect(serviceMock.findAll).not.toHaveBeenCalled();
  });

  it('rechaza con 403 un ?tenant= distinto al del token', () => {
    const req = makeReq({ query: { tenant: 'tenant-ajeno' } });

    expect(() => controller.findAll(req)).toThrow(ForbiddenException);
    expect(serviceMock.findAll).not.toHaveBeenCalled();
  });

  it('admite la cabecera cuando coincide con el tenant del token', async () => {
    serviceMock.findAll.mockResolvedValue([]);
    const req = makeReq({ headers: { 'x-tenant-id': TENANT } });

    await controller.findAll(req);

    expect(serviceMock.findAll).toHaveBeenCalledWith(TENANT);
  });

  it('update pasa tenant, usuario e IP al servicio', async () => {
    const dto = { color: 'Azul' } as any;

    await controller.update('1', dto, makeReq());

    expect(serviceMock.update).toHaveBeenCalledWith(
      '1',
      dto,
      TENANT,
      'user1',
      '10.0.0.5',
    );
  });

  it('remove pasa tenant, usuario e IP al servicio', async () => {
    await controller.remove('1', makeReq());

    expect(serviceMock.remove).toHaveBeenCalledWith('1', TENANT, 'user1', '10.0.0.5');
  });
});
