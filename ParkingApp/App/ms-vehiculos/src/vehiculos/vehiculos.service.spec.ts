import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { VehiculosService } from './vehiculos.service';
import { Vehiculo } from './entities/vehiculo.entity';
import { EventPublisher } from '../common/event-publisher.service';
import { CacheService } from '../common/cache.service';

describe('VehiculosService', () => {
  let service: VehiculosService;

  const TENANT = 'tenant-1';

  const repoMock = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const publisherMock = { publishEvent: jest.fn() };
  const cacheMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  const createDto = {
    tipo: 'auto',
    datos: {
      placa: 'ABC-1234',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Rojo',
      anio: 2024,
      numeroPuertas: 4,
      CapacidadMaletero: 400,
    },
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    cacheMock.get.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiculosService,
        { provide: getRepositoryToken(Vehiculo), useValue: repoMock },
        { provide: EventPublisher, useValue: publisherMock },
        { provide: CacheService, useValue: cacheMock },
      ],
    }).compile();

    service = module.get<VehiculosService>(VehiculosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('guarda el vehículo con el tenant y publica evento CREATE', async () => {
      const saved = { id: '1', placa: 'ABC-1234', tenantId: TENANT };
      repoMock.findOne.mockResolvedValue(null);
      repoMock.save.mockResolvedValue(saved);

      const result = await service.create(createDto, TENANT, 'user1', '10.0.0.1');

      expect(result).toBe(saved);
      expect(repoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: TENANT }),
      );
      expect(publisherMock.publishEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          servicio: 'ms-vehiculos',
          accion: 'CREATE',
          entidad: 'Vehiculo',
          usuario: 'user1',
          ip: '10.0.0.1',
          tenantId: TENANT,
        }),
      );
    });

    it('lanza ConflictException si la placa ya existe en el tenant', async () => {
      repoMock.findOne.mockResolvedValue({ id: '1', placa: 'ABC-1234' });

      await expect(service.create(createDto, TENANT)).rejects.toThrow(
        ConflictException,
      );
      expect(repoMock.save).not.toHaveBeenCalled();
    });
  });

  it('findAll devuelve solo los vehículos del tenant', async () => {
    const vehiculos = [{ id: '1' }, { id: '2' }];
    repoMock.find.mockResolvedValue(vehiculos);

    await expect(service.findAll(TENANT)).resolves.toBe(vehiculos);
    expect(repoMock.find).toHaveBeenCalledWith({
      where: { tenantId: TENANT },
    });
  });

  describe('findOne', () => {
    it('devuelve el vehículo cuando existe', async () => {
      const vehiculo = { id: '1' };
      repoMock.findOne.mockResolvedValue(vehiculo);

      await expect(service.findOne('1', TENANT)).resolves.toBe(vehiculo);
    });

    it('lanza NotFoundException cuando no existe', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(service.findOne('nope', TENANT)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPlaca', () => {
    it('devuelve el vehículo cuando existe en el tenant', async () => {
      const vehiculo = { id: '1', placa: 'ABC-1234' };
      repoMock.findOne.mockResolvedValue(vehiculo);

      await expect(service.findByPlaca('ABC-1234', TENANT)).resolves.toBe(vehiculo);
      expect(repoMock.findOne).toHaveBeenCalledWith({
        where: { placa: 'ABC-1234', tenantId: TENANT },
      });
    });

    it('usa la clave de caché con namespace de tenant', async () => {
      const vehiculo = { id: '1', placa: 'ABC-1234' };
      repoMock.findOne.mockResolvedValue(vehiculo);

      await service.findByPlaca('ABC-1234', TENANT);

      expect(cacheMock.get).toHaveBeenCalledWith(`t:${TENANT}:vehiculo:ABC-1234`);
      expect(cacheMock.set).toHaveBeenCalledWith(
        `t:${TENANT}:vehiculo:ABC-1234`,
        vehiculo,
      );
    });

    it('lanza NotFoundException cuando no existe', async () => {
      repoMock.findOne.mockResolvedValue(null);

      await expect(service.findByPlaca('ZZZ-9999', TENANT)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it('update guarda los cambios y publica evento UPDATE', async () => {
    const vehiculo = { id: '1', color: 'Rojo' };
    repoMock.findOne.mockResolvedValue(vehiculo);
    repoMock.save.mockResolvedValue(vehiculo);

    const result = await service.update('1', { color: 'Azul' } as any, TENANT);

    expect(repoMock.save).toHaveBeenCalled();
    expect(result).toBe(vehiculo);
    expect(publisherMock.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'UPDATE' }),
    );
  });

  it('remove elimina el vehículo y publica evento DELETE', async () => {
    const vehiculo = { id: '1' };
    repoMock.findOne.mockResolvedValue(vehiculo);

    await service.remove('1', TENANT);

    expect(repoMock.remove).toHaveBeenCalledWith(vehiculo);
    expect(publisherMock.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'DELETE' }),
    );
  });
});
