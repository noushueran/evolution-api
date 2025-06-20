import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { InstanceController } from '@api/controllers/instance.controller';
import { WAMonitoringService } from '@api/services/monitor.service';
import { CacheService } from '@api/services/cache.service';
import { SettingsService } from '@api/services/settings.service';
import { ChatwootService } from '@api/integrations/chatbot/chatwoot/services/chatwoot.service';
import { ProviderFiles } from '@api/provider/sessions';
import { ProxyController } from '@api/controllers/proxy.controller';
import { InstanceDto } from '@api/dto/instance.dto';
import { Integration } from '@api/types/wa.types';
import { BadRequestException, UnauthorizedException } from '@exceptions';
import EventEmitter2 from 'eventemitter2';
import { createMockConfigService, createMockPrismaRepository, createTestInstance } from '../../helpers/test-utils';

// Mock the channelController
jest.mock('@api/server.module', () => ({
  channelController: {
    init: jest.fn(),
  },
}));

import { channelController } from '@api/server.module';

describe('InstanceController', () => {
  let instanceController: InstanceController;
  let mockWaMonitor: jest.Mocked<WAMonitoringService>;
  let mockConfigService: any;
  let mockPrismaRepository: any;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockChatwootService: jest.Mocked<ChatwootService>;
  let mockSettingsService: jest.Mocked<SettingsService>;
  let mockProxyService: jest.Mocked<ProxyController>;
  let mockCache: jest.Mocked<CacheService>;
  let mockChatwootCache: jest.Mocked<CacheService>;
  let mockBaileysCache: jest.Mocked<CacheService>;
  let mockProviderFiles: jest.Mocked<ProviderFiles>;

  beforeEach(() => {
    // Create mocks
    mockWaMonitor = {
      waInstances: {},
      saveInstance: jest.fn(),
      deleteInstance: jest.fn(),
      instanceInfo: jest.fn(),
      instanceInfoById: jest.fn(),
    } as any;

    mockConfigService = createMockConfigService();
    mockPrismaRepository = createMockPrismaRepository();

    mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    } as any;

    mockChatwootService = {
      create: jest.fn(),
    } as any;

    mockSettingsService = {
      create: jest.fn(),
      find: jest.fn(),
    } as any;

    mockProxyService = {
      create: jest.fn(),
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockChatwootCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockBaileysCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockProviderFiles = {
      allInstances: jest.fn(),
    } as any;

    // Create controller instance
    instanceController = new InstanceController(
      mockWaMonitor,
      mockConfigService,
      mockPrismaRepository,
      mockEventEmitter,
      mockChatwootService,
      mockSettingsService,
      mockProxyService,
      mockCache,
      mockChatwootCache,
      mockBaileysCache,
      mockProviderFiles,
    );
  });

  describe('createInstance', () => {
    const instanceData: InstanceDto = {
      instanceName: 'test-instance',
      integration: Integration.WHATSAPP_BAILEYS,
      qrcode: true,
    };

    beforeEach(() => {
      // Mock channelController.init to return a mock instance
      const mockInstance = {
        setInstance: jest.fn(),
        connectToWhatsapp: jest.fn(),
        connectionStatus: { state: 'close' },
        instanceName: 'test-instance',
        qrCode: { base64: 'mock-qr-code' },
      };

      (channelController.init as jest.Mock).mockReturnValue(mockInstance);
      mockWaMonitor.saveInstance.mockResolvedValue(undefined);
      mockSettingsService.find.mockResolvedValue(null);
    });

    it('should create instance successfully', async () => {
      const result = await instanceController.createInstance(instanceData);

      expect(channelController.init).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceName: 'test-instance',
          integration: Integration.WHATSAPP_BAILEYS,
        }),
        expect.any(Object),
      );

      expect(mockWaMonitor.saveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceName: 'test-instance',
          integration: Integration.WHATSAPP_BAILEYS,
        }),
      );

      expect(result).toHaveProperty('instance');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('qrcode');
      expect(result.instance.instanceName).toBe('test-instance');
    });

    it('should generate token when not provided', async () => {
      await instanceController.createInstance(instanceData);

      expect(mockWaMonitor.saveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: expect.any(String),
        }),
      );
    });

    it('should use provided token when available', async () => {
      const instanceDataWithToken = {
        ...instanceData,
        token: 'custom-token',
      };

      await instanceController.createInstance(instanceDataWithToken);

      expect(mockWaMonitor.saveInstance).toHaveBeenCalledWith(
        expect.objectContaining({
          hash: 'custom-token',
        }),
      );
    });

    it('should throw BadRequestException when channelController.init returns null', async () => {
      (channelController.init as jest.Mock).mockReturnValue(null);

      await expect(instanceController.createInstance(instanceData)).rejects.toThrow(
        new BadRequestException('Invalid integration'),
      );
    });

    it('should handle errors and delete instance on failure', async () => {
      const error = new Error('Connection failed');
      (channelController.init as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(instanceController.createInstance(instanceData)).rejects.toThrow(BadRequestException);
      expect(mockWaMonitor.deleteInstance).toHaveBeenCalledWith('test-instance');
    });
  });

  describe('fetchInstances', () => {
    const testInstance = createTestInstance();

    it('should return all instances for global API key', async () => {
      const globalApiKey = 'test-api-key';
      mockWaMonitor.instanceInfo.mockResolvedValue([testInstance]);

      const result = await instanceController.fetchInstances({ instanceName: '' } as any, globalApiKey);

      expect(mockWaMonitor.instanceInfo).toHaveBeenCalledWith(null);
      expect(result).toEqual([testInstance]);
    });

    it('should return specific instance by name for global API key', async () => {
      const globalApiKey = 'test-api-key';
      const instanceName = 'test-instance';
      mockWaMonitor.instanceInfo.mockResolvedValue([testInstance]);

      const result = await instanceController.fetchInstances({ instanceName }, globalApiKey);

      expect(mockWaMonitor.instanceInfo).toHaveBeenCalledWith([instanceName]);
      expect(result).toEqual([testInstance]);
    });

    it('should return instance by ID for global API key', async () => {
      const globalApiKey = 'test-api-key';
      const instanceId = 'test-instance-id';
      mockWaMonitor.instanceInfoById.mockResolvedValue([testInstance]);

      const result = await instanceController.fetchInstances({ instanceName: '', instanceId } as any, globalApiKey);

      expect(mockWaMonitor.instanceInfoById).toHaveBeenCalledWith(instanceId, undefined);
      expect(result).toEqual([testInstance]);
    });

    it('should return instance by number for global API key', async () => {
      const globalApiKey = 'test-api-key';
      const number = '5511999999999';
      mockWaMonitor.instanceInfoById.mockResolvedValue([testInstance]);

      const result = await instanceController.fetchInstances({ instanceName: '', number } as any, globalApiKey);

      expect(mockWaMonitor.instanceInfoById).toHaveBeenCalledWith(undefined, number);
      expect(result).toEqual([testInstance]);
    });

    it('should return instances for valid instance token', async () => {
      const instanceToken = 'instance-token';
      mockPrismaRepository.instance.findMany.mockResolvedValue([testInstance]);
      mockWaMonitor.instanceInfo.mockResolvedValue([testInstance]);

      const result = await instanceController.fetchInstances({ instanceName: '' } as any, instanceToken);

      expect(mockPrismaRepository.instance.findMany).toHaveBeenCalledWith({
        where: {
          token: instanceToken,
          name: undefined,
          id: undefined,
        },
      });
      expect(mockWaMonitor.instanceInfo).toHaveBeenCalledWith([testInstance.name]);
      expect(result).toEqual([testInstance]);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      const invalidToken = 'invalid-token';
      mockPrismaRepository.instance.findMany.mockResolvedValue([]);

      await expect(instanceController.fetchInstances({ instanceName: '' } as any, invalidToken)).rejects.toThrow(
        new UnauthorizedException(),
      );
    });
  });

  describe('connectToWhatsapp', () => {
    const instanceName = 'test-instance';

    beforeEach(() => {
      mockWaMonitor.waInstances[instanceName] = {
        connectionStatus: { state: 'close' },
        connectToWhatsapp: jest.fn(),
        qrCode: { base64: 'mock-qr-code' },
      };
    });

    it('should connect to WhatsApp when instance is closed', async () => {
      const result = await instanceController.connectToWhatsapp({ instanceName });

      expect(mockWaMonitor.waInstances[instanceName].connectToWhatsapp).toHaveBeenCalled();
      expect(result).toHaveProperty('base64', 'mock-qr-code');
    });

    it('should return connection state when instance is already open', async () => {
      mockWaMonitor.waInstances[instanceName].connectionStatus.state = 'open';
      
      // Mock connectionState method
      const connectionStateSpy = jest.spyOn(instanceController, 'connectionState' as any);
      connectionStateSpy.mockResolvedValue({
        instance: { instanceName, status: 'open' },
      });

      const result = await instanceController.connectToWhatsapp({ instanceName });

      expect(connectionStateSpy).toHaveBeenCalledWith({ instanceName });
      expect(result.instance.status).toBe('open');

      connectionStateSpy.mockRestore();
    });

    it('should return QR code when instance is connecting', async () => {
      mockWaMonitor.waInstances[instanceName].connectionStatus.state = 'connecting';

      const result = await instanceController.connectToWhatsapp({ instanceName });

      expect(result).toEqual({ base64: 'mock-qr-code' });
    });

    it('should throw BadRequestException when instance does not exist', async () => {
      const nonExistentInstance = 'non-existent';

      const result = await instanceController.connectToWhatsapp({ instanceName: nonExistentInstance });

      expect(result).toHaveProperty('error', true);
      expect(result.message).toContain('does not exist');
    });
  });

  describe('deleteInstance', () => {
    const instanceName = 'test-instance';

    beforeEach(() => {
      mockWaMonitor.waInstances[instanceName] = {
        clearCacheChatwoot: jest.fn(),
        sendDataWebhook: jest.fn(),
        instanceId: 'test-instance-id',
      };

      // Mock connectionState method
      const connectionStateSpy = jest.spyOn(instanceController, 'connectionState' as any);
      connectionStateSpy.mockResolvedValue({
        instance: { instanceName, state: 'close' },
      });
    });

    it('should delete instance successfully', async () => {
      const result = await instanceController.deleteInstance({ instanceName });

      expect(mockWaMonitor.deleteInstance).toHaveBeenCalledWith(instanceName);
      expect(result).toHaveProperty('status', 'SUCCESS');
      expect(result).toHaveProperty('response');
      expect(result.response).toHaveProperty('message', 'Instance deleted');
    });

    it('should clear Chatwoot cache when enabled', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'CHATWOOT') return { ENABLED: true };
        return createMockConfigService().get(key as any);
      });

      await instanceController.deleteInstance({ instanceName });

      expect(mockWaMonitor.waInstances[instanceName].clearCacheChatwoot).toHaveBeenCalled();
    });

    it('should send webhook event on deletion', async () => {
      await instanceController.deleteInstance({ instanceName });

      expect(mockWaMonitor.waInstances[instanceName].sendDataWebhook).toHaveBeenCalledWith(
        'INSTANCE_DELETE',
        {
          instanceName,
          instanceId: 'test-instance-id',
        },
      );
    });
  });
});
