import { jest } from '@jest/globals';
import { ConfigService } from '@config/env.config';
import { PrismaRepository } from '@api/repository/repository.service';

// Mock ConfigService for tests
export const createMockConfigService = (): jest.Mocked<ConfigService> => {
  const mockConfigService = {
    get: jest.fn(),
  } as any;

  // Default configuration values for tests
  mockConfigService.get.mockImplementation((key: string) => {
    const config = {
      DATABASE: {
        ENABLED: true,
        PROVIDER: 'postgresql',
        CONNECTION: {
          URI: 'postgresql://test:test@localhost:5432/evolution_test',
          CLIENT_NAME: 'evolution_test',
        },
        SAVE_DATA: {
          INSTANCE: true,
          NEW_MESSAGE: true,
          MESSAGE_UPDATE: true,
          CONTACTS: true,
          CHATS: true,
          LABELS: true,
          HISTORIC: true,
        },
      },
      AUTHENTICATION: {
        API_KEY: {
          KEY: 'test-api-key',
        },
        EXPOSE_IN_FETCH_INSTANCES: true,
      },
      CACHE: {
        REDIS: {
          ENABLED: false,
          URI: '',
          PREFIX_KEY: 'evolution-test',
          TTL: 604800,
          SAVE_INSTANCES: false,
        },
        LOCAL: {
          ENABLED: true,
          TTL: 86400,
        },
      },
      SERVER: {
        TYPE: 'http',
        PORT: 8080,
        URL: 'http://localhost:8080',
        DISABLE_DOCS: false,
        DISABLE_MANAGER: false,
      },
      LOG: {
        LEVEL: ['ERROR'],
        COLOR: false,
        BAILEYS: 'error',
      },
    };
    return config[key] || {};
  });

  return mockConfigService;
};

// Mock PrismaRepository for tests
export const createMockPrismaRepository = (): jest.Mocked<PrismaRepository> => {
  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
    instance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    setting: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contact: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    chat: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;
};

// Test data factories
export const createTestInstance = (overrides = {}) => ({
  id: 'test-instance-id',
  name: 'test-instance',
  token: 'test-token',
  integration: 'WHATSAPP-BAILEYS',
  status: 'open',
  ownerJid: '5511999999999@s.whatsapp.net',
  profileName: 'Test Profile',
  profilePicUrl: null,
  number: '5511999999999',
  businessId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestSettings = (overrides = {}) => ({
  id: 'test-settings-id',
  instanceId: 'test-instance-id',
  rejectCall: false,
  msgCall: 'Call rejected',
  groupsIgnore: false,
  alwaysOnline: false,
  readMessages: false,
  readStatus: false,
  syncFullHistory: false,
  wavoipToken: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createTestMessage = (overrides = {}) => ({
  id: 'test-message-id',
  key: {
    remoteJid: '5511999999999@s.whatsapp.net',
    fromMe: false,
    id: 'test-message-key-id',
  },
  pushName: 'Test User',
  message: {
    conversation: 'Test message',
  },
  messageType: 'conversation',
  messageTimestamp: Date.now(),
  instanceId: 'test-instance-id',
  source: 'android',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
