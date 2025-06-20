import { jest } from '@jest/globals';

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PROVIDER = 'postgresql';
  process.env.DATABASE_CONNECTION_URI = 'postgresql://test:test@localhost:5432/evolution_test';
  process.env.AUTHENTICATION_API_KEY = 'test-api-key';
  process.env.CACHE_REDIS_ENABLED = 'false';
  process.env.CACHE_LOCAL_ENABLED = 'true';
  process.env.LOG_LEVEL = 'ERROR';
});

afterAll(async () => {
  // Cleanup after all tests
});

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

// Mock external dependencies
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  setupExpressErrorHandler: jest.fn(),
}));

// Mock Sentry instrumentation - skip for tests

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    instance: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    setting: {
      create: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  })),
}));

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  })),
}));

// Mock Baileys
jest.mock('baileys', () => ({
  makeWASocket: jest.fn(),
  useMultiFileAuthState: jest.fn(),
  DisconnectReason: {},
  ConnectionState: {},
}));
