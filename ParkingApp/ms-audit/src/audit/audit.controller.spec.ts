import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

describe('AuditController', () => {
  let controller: AuditController;

  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findone: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: serviceMock }],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delega en el servicio', async () => {
    const dto = { servicio: 'ms-vehiculos', accion: 'CREATE' } as any;
    serviceMock.create.mockResolvedValue({ id: '1' });

    await expect(controller.create(dto)).resolves.toEqual({ id: '1' });
    expect(serviceMock.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delega en el servicio', async () => {
    serviceMock.findAll.mockResolvedValue([]);

    await expect(controller.findAll()).resolves.toEqual([]);
    expect(serviceMock.findAll).toHaveBeenCalled();
  });

  it('findOne delega en el servicio', async () => {
    serviceMock.findone.mockResolvedValue({ id: 'abc' });

    await expect(controller.findOne('abc')).resolves.toEqual({ id: 'abc' });
    expect(serviceMock.findone).toHaveBeenCalledWith('abc');
  });
});
