import { Test, TestingModule } from '@nestjs/testing';
import { VehiculosController } from './vehiculos.controller';
import { VehiculosService } from './vehiculos.service';

describe('VehiculosController', () => {
  let controller: VehiculosController;

  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPlaca: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const makeReq = (overrides: any = {}) => ({
    user: { userId: 'user1' },
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

  it('create pasa usuario e IP del socket al servicio', async () => {
    const dto = { tipo: 'auto' } as any;
    serviceMock.create.mockResolvedValue({ id: '1' });

    await controller.create(dto, makeReq());

    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'user1', '10.0.0.5');
  });

  it('create toma la primera IP de x-forwarded-for', async () => {
    const dto = { tipo: 'auto' } as any;
    const req = makeReq({
      headers: { 'x-forwarded-for': '200.1.1.1, 10.0.0.2' },
    });

    await controller.create(dto, req);

    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'user1', '200.1.1.1');
  });

  it('create usa "system" cuando no hay usuario autenticado', async () => {
    const dto = { tipo: 'auto' } as any;

    await controller.create(dto, makeReq({ user: undefined }));

    expect(serviceMock.create).toHaveBeenCalledWith(dto, 'system', '10.0.0.5');
  });

  it('findAll delega en el servicio', async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await expect(controller.findAll()).resolves.toEqual([]);
  });

  it('findOne delega en el servicio', async () => {
    serviceMock.findOne.mockResolvedValue({ id: '1' });

    await expect(controller.findOne('1')).resolves.toEqual({ id: '1' });
    expect(serviceMock.findOne).toHaveBeenCalledWith('1');
  });

  it('findByPlaca delega en el servicio', async () => {
    serviceMock.findByPlaca.mockResolvedValue({ placa: 'ABC-1234' });

    await expect(controller.findByPlaca('ABC-1234')).resolves.toEqual({
      placa: 'ABC-1234',
    });
    expect(serviceMock.findByPlaca).toHaveBeenCalledWith('ABC-1234');
  });

  it('update pasa usuario e IP al servicio', async () => {
    const dto = { color: 'Azul' } as any;

    await controller.update('1', dto, makeReq());

    expect(serviceMock.update).toHaveBeenCalledWith(
      '1',
      dto,
      'user1',
      '10.0.0.5',
    );
  });

  it('remove pasa usuario e IP al servicio', async () => {
    await controller.remove('1', makeReq());

    expect(serviceMock.remove).toHaveBeenCalledWith('1', 'user1', '10.0.0.5');
  });
});
