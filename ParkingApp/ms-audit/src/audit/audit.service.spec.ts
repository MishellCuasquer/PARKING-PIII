import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { EventoAuditoria } from './entities/evento-auditoria.entity';

describe('AuditService', () => {
  let service: AuditService;

  const repoMock = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(EventoAuditoria), useValue: repoMock },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create guarda el evento con timestamp', async () => {
    const dto = {
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'Vehiculo',
      datos: {},
      usuario: 'system',
      ip: '127.0.0.1',
      mac: 'N/A',
    };
    const entity = { id: '1', ...dto };
    repoMock.create.mockReturnValue(entity);
    repoMock.save.mockResolvedValue(entity);

    const result = await service.create(dto as any);

    expect(repoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ ...dto, timestamp: expect.any(Date) }),
    );
    expect(repoMock.save).toHaveBeenCalledWith(entity);
    expect(result).toBe(entity);
  });

  it('findAll devuelve los eventos ordenados por timestamp descendente', async () => {
    const eventos = [{ id: '1' }, { id: '2' }];
    repoMock.find.mockResolvedValue(eventos);

    const result = await service.findAll();

    expect(repoMock.find).toHaveBeenCalledWith({
      order: { timestamp: 'DESC' },
    });
    expect(result).toBe(eventos);
  });

  it('findone busca por id', async () => {
    const evento = { id: 'abc' };
    repoMock.findOne.mockResolvedValue(evento);

    const result = await service.findone('abc');

    expect(repoMock.findOne).toHaveBeenCalledWith({ where: { id: 'abc' } });
    expect(result).toBe(evento);
  });
});
