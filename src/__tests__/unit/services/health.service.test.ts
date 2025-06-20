import { HealthService, HealthStatus } from '@api/services/health.service';
import { ConfigService } from '@config/env.config';
import { PrismaRepository } from '@api/repository/repository.service';
import { CacheService } from '@api/services/cache.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';

// Mock dependencies
jest.mock('@config/logger.config');
jest.mock('@config/env.config');
jest.mock('@api/repository/repository.service');
jest.mock('@api/services/cache.service');
jest.mock('@api/services/monitor.service');

describe('HealthService', () => {
  let healthService: HealthService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockPrismaRepository: jest.Mocked<PrismaRepository>;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockWAMonitoringService: jest.Mocked<WAMonitoringService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockPrismaRepository = {
      $queryRaw: jest.fn(),
    } as any;

    mockCacheService = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockWAMonitoringService = {
      waInstances: {},
    } as any;

    // Make waInstances writable for testing
    Object.defineProperty(mockWAMonitoringService, 'waInstances', {
      writable: true,
      value: {},
    });

    // Create service instance
    healthService = new HealthService(
      mockConfigService,
      mockPrismaRepository,
      mockCacheService,
      mockWAMonitoringService,
    );
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when all dependencies are working', async () => {
      // Mock successful database connection
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock Redis enabled and working
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: true },
      });
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.get.mockResolvedValue('test');
      mockCacheService.delete.mockResolvedValue(undefined);

      // Mock instances
      Object.defineProperty(mockWAMonitoringService, 'waInstances', {
        value: {
          'instance1': { connectionStatus: { state: 'open' } },
          'instance2': { connectionStatus: { state: 'close' } },
        },
        writable: true,
      });

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.database.status).toBe('connected');
      expect(result.redis.status).toBe('connected');
      expect(result.instances.total).toBe(2);
      expect(result.instances.active).toBe(1);
      expect(result.instances.inactive).toBe(1);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(result.memory.used).toBeGreaterThan(0);
      expect(result.system.nodeVersion).toBe(process.version);
    });

    it('should return unhealthy status when database is disconnected', async () => {
      // Mock database connection failure
      mockPrismaRepository.$queryRaw.mockRejectedValue(new Error('Connection failed'));

      // Mock Redis disabled
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: false },
      });

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('unhealthy');
      expect(result.database.status).toBe('error');
      expect(result.database.error).toBe('Connection failed');
      expect(result.redis.status).toBe('disabled');
    });

    it('should return degraded status when Redis fails but database is healthy', async () => {
      // Mock successful database connection
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock Redis enabled but failing
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: true },
      });
      mockCacheService.set.mockRejectedValue(new Error('Redis connection failed'));

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.database.status).toBe('connected');
      expect(result.redis.status).toBe('error');
      expect(result.redis.error).toBe('Redis connection failed');
    });

    it('should handle Redis disabled configuration', async () => {
      // Mock successful database connection
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock Redis disabled
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: false },
      });

      const result = await healthService.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.database.status).toBe('connected');
      expect(result.redis.status).toBe('disabled');
    });

    it('should measure database response time', async () => {
      // Mock successful database connection with delay
      mockPrismaRepository.$queryRaw.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([{ '?column?': 1 }]), 50)) as any
      );

      // Mock Redis disabled
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: false },
      });

      const result = await healthService.getHealthStatus();

      expect(result.database.status).toBe('connected');
      expect(result.database.responseTime).toBeGreaterThan(40);
      expect(result.database.responseTime).toBeLessThan(100);
    });

    it('should measure Redis response time', async () => {
      // Mock successful database connection
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      // Mock Redis enabled with delay
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: true },
      });
      mockCacheService.set.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(undefined), 30)) as any
      );
      mockCacheService.get.mockResolvedValue('test');
      mockCacheService.delete.mockResolvedValue(undefined);

      const result = await healthService.getHealthStatus();

      expect(result.redis.status).toBe('connected');
      expect(result.redis.responseTime).toBeGreaterThan(25);
      expect(result.redis.responseTime).toBeLessThan(60);
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus formatted metrics', async () => {
      // Mock successful health status
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: true },
      });
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.get.mockResolvedValue('test');
      mockCacheService.delete.mockResolvedValue(undefined);

      const metrics = await healthService.getMetrics();

      expect(metrics).toContain('evolution_api_uptime_seconds');
      expect(metrics).toContain('evolution_api_memory_usage_bytes');
      expect(metrics).toContain('evolution_api_instances_total');
      expect(metrics).toContain('evolution_api_database_up 1');
      expect(metrics).toContain('evolution_api_redis_up 1');
      expect(metrics).toContain('# HELP');
      expect(metrics).toContain('# TYPE');
    });

    it('should handle metrics generation failure', async () => {
      // Mock successful database and Redis
      mockPrismaRepository.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockConfigService.get.mockReturnValue({
        REDIS: { ENABLED: false },
      });

      // Mock formatPrometheusMetrics to throw an error by making it fail
      const originalFormatPrometheusMetrics = (healthService as any).formatPrometheusMetrics;
      (healthService as any).formatPrometheusMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Formatting error');
      });

      await expect(healthService.getMetrics()).rejects.toThrow('Formatting error');

      // Restore original method
      (healthService as any).formatPrometheusMetrics = originalFormatPrometheusMetrics;
    });
  });
});
