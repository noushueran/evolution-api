import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { WAMonitoringService } from '@api/services/monitor.service';
import { CacheService } from '@api/services/cache.service';
import { ProviderFiles } from '@api/provider/sessions';
import { Integration } from '@api/types/wa.types';
import { NotFoundException } from '@exceptions';
import EventEmitter2 from 'eventemitter2';
import { createMockConfigService, createMockPrismaRepository, createTestInstance } from '../../helpers/test-utils';

describe('WAMonitoringService', () => {
  let waMonitoringService: WAMonitoringService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockConfigService: any;
  let mockPrismaRepository: any;
  let mockProviderFiles: jest.Mocked<ProviderFiles>;
  let mockCache: jest.Mocked<CacheService>;
  let mockChatwootCache: jest.Mocked<CacheService>;
  let mockBaileysCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    // Create mocks
    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    } as any;

    mockConfigService = createMockConfigService();
    mockPrismaRepository = createMockPrismaRepository();

    mockProviderFiles = {
      allInstances: jest.fn(),
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      deleteAll: jest.fn(),
    } as any;

    mockChatwootCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      deleteAll: jest.fn(),
    } as any;

    mockBaileysCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      keys: jest.fn(),
      deleteAll: jest.fn(),
    } as any;

    // Create service instance
    waMonitoringService = new WAMonitoringService(
      mockEventEmitter,
      mockConfigService,
      mockPrismaRepository,
      mockProviderFiles,
      mockCache,
      mockChatwootCache,
      mockBaileysCache,
    );
  });

  describe('constructor', () => {
    it('should initialize with correct dependencies', () => {
      expect(waMonitoringService).toBeDefined();
      expect(waMonitoringService.waInstances).toBeDefined();
      expect(typeof waMonitoringService.waInstances).toBe('object');
    });
  });

  describe('instanceInfo', () => {
    const testInstance = createTestInstance();

    beforeEach(() => {
      mockPrismaRepository.instance.findMany.mockResolvedValue([testInstance]);
    });

    it('should return all instances when no instanceNames provided', async () => {
      const result = await waMonitoringService.instanceInfo();

      expect(mockPrismaRepository.instance.findMany).toHaveBeenCalledWith({
        where: { clientName: 'evolution_test' },
        include: {
          Chatwoot: true,
          Proxy: true,
          Rabbitmq: true,
          Nats: true,
          Sqs: true,
          Websocket: true,
          Setting: true,
          _count: {
            select: {
              Message: true,
              Contact: true,
              Chat: true,
            },
          },
        },
      });

      expect(result).toEqual([testInstance]);
    });

    it('should return specific instances when instanceNames provided', async () => {
      const instanceNames = ['test-instance'];
      waMonitoringService.waInstances['test-instance'] = {}; // Mock instance exists

      const result = await waMonitoringService.instanceInfo(instanceNames);

      expect(mockPrismaRepository.instance.findMany).toHaveBeenCalledWith({
        where: {
          name: { in: instanceNames },
          clientName: 'evolution_test',
        },
        include: expect.any(Object),
      });

      expect(result).toEqual([testInstance]);
    });

    it('should throw NotFoundException for non-existent instances', async () => {
      const instanceNames = ['non-existent-instance'];

      await expect(waMonitoringService.instanceInfo(instanceNames)).rejects.toThrow(
        new NotFoundException('Instance "non-existent-instance" not found'),
      );
    });

    it('should throw NotFoundException for multiple non-existent instances', async () => {
      const instanceNames = ['non-existent-1', 'non-existent-2'];

      await expect(waMonitoringService.instanceInfo(instanceNames)).rejects.toThrow(
        new NotFoundException('Instances "non-existent-1, non-existent-2" not found'),
      );
    });
  });

  describe('instanceInfoById', () => {
    const testInstance = createTestInstance();

    it('should return instance info by instanceId', async () => {
      mockPrismaRepository.instance.findFirst.mockResolvedValue(testInstance);
      mockPrismaRepository.instance.findMany.mockResolvedValue([testInstance]);
      waMonitoringService.waInstances[testInstance.name] = {}; // Mock instance exists

      const result = await waMonitoringService.instanceInfoById(testInstance.id);

      expect(mockPrismaRepository.instance.findFirst).toHaveBeenCalledWith({
        where: { id: testInstance.id },
      });
      expect(result).toEqual([testInstance]);
    });

    it('should return instance info by number', async () => {
      mockPrismaRepository.instance.findFirst.mockResolvedValue(testInstance);
      mockPrismaRepository.instance.findMany.mockResolvedValue([testInstance]);
      waMonitoringService.waInstances[testInstance.name] = {}; // Mock instance exists

      const result = await waMonitoringService.instanceInfoById(undefined, testInstance.number);

      expect(mockPrismaRepository.instance.findFirst).toHaveBeenCalledWith({
        where: { number: testInstance.number },
      });
      expect(result).toEqual([testInstance]);
    });

    it('should throw NotFoundException when instance not found by id', async () => {
      mockPrismaRepository.instance.findFirst.mockResolvedValue(null);

      await expect(waMonitoringService.instanceInfoById('non-existent-id')).rejects.toThrow(
        new NotFoundException('Instance "non-existent-id" not found'),
      );
    });

    it('should throw NotFoundException when instance not found by number', async () => {
      mockPrismaRepository.instance.findFirst.mockResolvedValue(null);

      await expect(waMonitoringService.instanceInfoById(undefined, '999999999')).rejects.toThrow(
        new NotFoundException('Instance "999999999" not found'),
      );
    });

    it('should throw NotFoundException when instance not loaded in memory', async () => {
      mockPrismaRepository.instance.findFirst.mockResolvedValue(testInstance);

      await expect(waMonitoringService.instanceInfoById(testInstance.id)).rejects.toThrow(
        new NotFoundException(`Instance "${testInstance.name}" not found`),
      );
    });
  });

  describe('saveInstance', () => {
    it('should save instance to database', async () => {
      const instanceData = {
        instanceId: 'test-id',
        instanceName: 'test-instance',
        ownerJid: '5511999999999@s.whatsapp.net',
        profileName: 'Test Profile',
        profilePicUrl: null,
        status: 'open',
        number: '5511999999999',
        integration: Integration.WHATSAPP_BAILEYS,
        hash: 'test-token',
        businessId: null,
      };

      mockPrismaRepository.instance.create.mockResolvedValue(createTestInstance());

      await waMonitoringService.saveInstance(instanceData);

      expect(mockPrismaRepository.instance.create).toHaveBeenCalledWith({
        data: {
          id: instanceData.instanceId,
          name: instanceData.instanceName,
          ownerJid: instanceData.ownerJid,
          profileName: instanceData.profileName,
          profilePicUrl: instanceData.profilePicUrl,
          connectionStatus: 'close', // WHATSAPP_BAILEYS defaults to 'close'
          number: instanceData.number,
          integration: instanceData.integration,
          token: instanceData.hash,
          clientName: 'evolution_test',
          businessId: instanceData.businessId,
        },
      });
    });

    it('should handle database errors gracefully', async () => {
      const instanceData = {
        instanceId: 'test-id',
        instanceName: 'test-instance',
        hash: 'test-token',
      };

      const error = new Error('Database error');
      mockPrismaRepository.instance.create.mockRejectedValue(error);

      // Should not throw, but log error
      await expect(waMonitoringService.saveInstance(instanceData)).resolves.toBeUndefined();
    });
  });

  describe('loadInstance', () => {
    it('should load instances from database when SAVE_DATA.INSTANCE is true', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PROVIDER') return { ENABLED: false };
        if (key === 'DATABASE') return { SAVE_DATA: { INSTANCE: true } };
        if (key === 'CACHE') return { REDIS: { ENABLED: false, SAVE_INSTANCES: false } };
        return {};
      });

      const testInstance = createTestInstance();
      mockPrismaRepository.instance.findMany.mockResolvedValue([testInstance]);

      await waMonitoringService.loadInstance();

      expect(mockPrismaRepository.instance.findMany).toHaveBeenCalledWith({
        where: { clientName: 'evolution_test' },
      });
    });

    it('should load instances from Redis when Redis is enabled and SAVE_INSTANCES is true', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PROVIDER') return { ENABLED: false };
        if (key === 'DATABASE') return { SAVE_DATA: { INSTANCE: false } };
        if (key === 'CACHE') return { REDIS: { ENABLED: true, SAVE_INSTANCES: true } };
        return {};
      });

      const keys = ['instance:test-id:test-instance'];
      mockCache.keys.mockResolvedValue(keys);
      mockPrismaRepository.instance.findUnique.mockResolvedValue(createTestInstance());

      await waMonitoringService.loadInstance();

      expect(mockCache.keys).toHaveBeenCalled();
      expect(mockPrismaRepository.instance.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-id' },
      });
    });

    it('should handle errors during instance loading', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PROVIDER') return { ENABLED: false };
        if (key === 'DATABASE') return { SAVE_DATA: { INSTANCE: true } };
        return {};
      });

      const error = new Error('Database error');
      mockPrismaRepository.instance.findMany.mockRejectedValue(error);

      // Should not throw, but log error
      await expect(waMonitoringService.loadInstance()).resolves.toBeUndefined();
    });
  });
});
