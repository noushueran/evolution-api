import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SettingsService } from '@api/services/settings.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { InstanceDto } from '@api/dto/instance.dto';
import { SettingsDto } from '@api/dto/settings.dto';
import { createTestSettings } from '../../helpers/test-utils';

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockWaMonitor: jest.Mocked<WAMonitoringService>;

  beforeEach(() => {
    // Create mock WAMonitoringService
    mockWaMonitor = {
      waInstances: {},
    } as any;

    // Create service instance
    settingsService = new SettingsService(mockWaMonitor);
  });

  describe('create', () => {
    const instanceDto: InstanceDto = {
      instanceName: 'test-instance',
    };

    const settingsDto: SettingsDto = {
      rejectCall: true,
      msgCall: 'Call rejected automatically',
      groupsIgnore: false,
      alwaysOnline: true,
      readMessages: false,
      readStatus: true,
      syncFullHistory: false,
      wavoipToken: 'test-token',
    };

    beforeEach(() => {
      // Mock the instance with setSettings method
      mockWaMonitor.waInstances[instanceDto.instanceName] = {
        setSettings: jest.fn().mockResolvedValue(undefined),
      };
    });

    it('should create settings successfully', async () => {
      const result = await settingsService.create(instanceDto, settingsDto);

      expect(mockWaMonitor.waInstances[instanceDto.instanceName].setSettings).toHaveBeenCalledWith(settingsDto);
      
      expect(result).toEqual({
        settings: {
          ...instanceDto,
          settings: settingsDto,
        },
      });
    });

    it('should call setSettings with correct parameters', async () => {
      await settingsService.create(instanceDto, settingsDto);

      expect(mockWaMonitor.waInstances[instanceDto.instanceName].setSettings).toHaveBeenCalledTimes(1);
      expect(mockWaMonitor.waInstances[instanceDto.instanceName].setSettings).toHaveBeenCalledWith(settingsDto);
    });

    it('should handle partial settings data', async () => {
      const partialSettings: SettingsDto = {
        rejectCall: true,
        alwaysOnline: false,
      };

      const result = await settingsService.create(instanceDto, partialSettings);

      expect(mockWaMonitor.waInstances[instanceDto.instanceName].setSettings).toHaveBeenCalledWith(partialSettings);
      expect(result.settings.settings).toEqual(partialSettings);
    });

    it('should handle empty settings object', async () => {
      const emptySettings: SettingsDto = {};

      const result = await settingsService.create(instanceDto, emptySettings);

      expect(mockWaMonitor.waInstances[instanceDto.instanceName].setSettings).toHaveBeenCalledWith(emptySettings);
      expect(result.settings.settings).toEqual(emptySettings);
    });

    it('should propagate errors from setSettings', async () => {
      const error = new Error('Failed to save settings');
      mockWaMonitor.waInstances[instanceDto.instanceName].setSettings.mockRejectedValue(error);

      await expect(settingsService.create(instanceDto, settingsDto)).rejects.toThrow(error);
    });
  });

  describe('find', () => {
    const instanceDto: InstanceDto = {
      instanceName: 'test-instance',
    };

    const mockSettings = createTestSettings();

    beforeEach(() => {
      // Mock the instance with findSettings method
      mockWaMonitor.waInstances[instanceDto.instanceName] = {
        findSettings: jest.fn(),
      };
    });

    it('should return settings when found', async () => {
      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(mockSettings);

      const result = await settingsService.find(instanceDto);

      expect(mockWaMonitor.waInstances[instanceDto.instanceName].findSettings).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSettings);
    });

    it('should return null when settings not found', async () => {
      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue({});

      const result = await settingsService.find(instanceDto);

      expect(result).toBeNull();
    });

    it('should return null when findSettings throws error', async () => {
      const error = new Error('Database connection failed');
      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockRejectedValue(error);

      const result = await settingsService.find(instanceDto);

      expect(result).toBeNull();
    });

    it('should return null when findSettings returns null', async () => {
      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(null);

      const result = await settingsService.find(instanceDto);

      expect(result).toBeNull();
    });

    it('should return null when findSettings returns undefined', async () => {
      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(undefined);

      const result = await settingsService.find(instanceDto);

      expect(result).toBeNull();
    });

    it('should handle settings with all boolean values', async () => {
      const booleanSettings = {
        rejectCall: true,
        groupsIgnore: false,
        alwaysOnline: true,
        readMessages: false,
        readStatus: true,
        syncFullHistory: false,
      };

      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(booleanSettings);

      const result = await settingsService.find(instanceDto);

      expect(result).toEqual(booleanSettings);
    });

    it('should handle settings with string values', async () => {
      const stringSettings = {
        msgCall: 'Custom call rejection message',
        wavoipToken: 'custom-token-123',
      };

      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(stringSettings);

      const result = await settingsService.find(instanceDto);

      expect(result).toEqual(stringSettings);
    });

    it('should handle mixed settings types', async () => {
      const mixedSettings = {
        rejectCall: true,
        msgCall: 'Call rejected',
        groupsIgnore: false,
        alwaysOnline: null,
        readMessages: undefined,
        wavoipToken: 'token-123',
      };

      mockWaMonitor.waInstances[instanceDto.instanceName].findSettings.mockResolvedValue(mixedSettings);

      const result = await settingsService.find(instanceDto);

      expect(result).toEqual(mixedSettings);
    });
  });

  describe('error handling', () => {
    const instanceDto: InstanceDto = {
      instanceName: 'non-existent-instance',
    };

    it('should handle missing instance in waInstances', async () => {
      // Don't add the instance to waInstances
      const settingsDto: SettingsDto = { rejectCall: true };

      await expect(settingsService.create(instanceDto, settingsDto)).rejects.toThrow();
    });

    it('should handle missing instance for find operation', async () => {
      // Don't add the instance to waInstances
      await expect(settingsService.find(instanceDto)).rejects.toThrow();
    });
  });
});
