import { Request, Response } from 'express';
import { HealthController } from '@api/controllers/health.controller';
import { HealthService, HealthStatus } from '@api/services/health.service';
import { Logger } from '@config/logger.config';

// Mock dependencies
jest.mock('@api/services/health.service');
jest.mock('@config/logger.config');

describe('HealthController', () => {
  let healthController: HealthController;
  let mockHealthService: jest.Mocked<HealthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  const mockHealthyStatus: HealthStatus = {
    status: 'healthy',
    version: '2.3.0',
    timestamp: '2024-01-01T00:00:00.000Z',
    uptime: 3600,
    database: { status: 'connected', responseTime: 10 },
    redis: { status: 'connected', responseTime: 5 },
    instances: { total: 2, active: 1, inactive: 1 },
    memory: { used: 100000000, total: 200000000, percentage: 50 },
    system: {
      nodeVersion: 'v18.0.0',
      platform: 'linux',
      arch: 'x64',
    },
  };

  const mockUnhealthyStatus: HealthStatus = {
    ...mockHealthyStatus,
    status: 'unhealthy',
    database: { status: 'error', error: 'Connection failed' },
    redis: { status: 'error', error: 'Redis unavailable' },
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockHealthService = {
      getHealthStatus: jest.fn(),
      getMetrics: jest.fn(),
    } as any;

    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    // Create controller instance
    healthController = new HealthController(mockHealthService);
  });

  describe('getHealth', () => {
    it('should return healthy status with 200 code', async () => {
      mockHealthService.getHealthStatus.mockResolvedValue(mockHealthyStatus);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getHealthStatus).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockHealthyStatus);
    });

    it('should return unhealthy status with 503 code', async () => {
      mockHealthService.getHealthStatus.mockResolvedValue(mockUnhealthyStatus);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getHealthStatus).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUnhealthyStatus);
    });

    it('should return degraded status with 200 code', async () => {
      const degradedStatus = { ...mockHealthyStatus, status: 'degraded' as const };
      mockHealthService.getHealthStatus.mockResolvedValue(degradedStatus);

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(degradedStatus);
    });

    it('should handle service errors gracefully', async () => {
      mockHealthService.getHealthStatus.mockRejectedValue(new Error('Service error'));

      await healthController.getHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'unhealthy',
          database: { status: 'error', error: 'Health check failed' },
          redis: { status: 'error', error: 'Health check failed' },
        })
      );
    });
  });

  describe('getReadiness', () => {
    it('should return ready when database is connected', async () => {
      mockHealthService.getHealthStatus.mockResolvedValue(mockHealthyStatus);

      await healthController.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
        })
      );
    });

    it('should return not ready when database is disconnected', async () => {
      const notReadyStatus = {
        ...mockHealthyStatus,
        database: { status: 'error' as const, error: 'Connection failed' },
      };
      mockHealthService.getHealthStatus.mockResolvedValue(notReadyStatus);

      await healthController.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          reason: 'Database not connected',
        })
      );
    });

    it('should handle readiness check errors', async () => {
      mockHealthService.getHealthStatus.mockRejectedValue(new Error('Service error'));

      await healthController.getReadiness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not ready',
          reason: 'Health check failed',
          error: 'Service error',
        })
      );
    });
  });

  describe('getLiveness', () => {
    it('should return alive status', async () => {
      await healthController.getLiveness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'alive',
          uptime: expect.any(Number),
          memory: expect.objectContaining({
            heapUsed: expect.any(Number),
            heapTotal: expect.any(Number),
          }),
        })
      );
    });

    it('should handle liveness check errors', async () => {
      // Mock process.uptime to throw an error
      const originalUptime = process.uptime;
      process.uptime = jest.fn().mockImplementation(() => {
        throw new Error('Process error');
      });

      await healthController.getLiveness(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not alive',
          error: 'Process error',
        })
      );

      // Restore original function
      process.uptime = originalUptime;
    });
  });

  describe('getMetrics', () => {
    it('should return Prometheus metrics', async () => {
      const mockMetrics = 'evolution_api_uptime_seconds 3600\nevolution_api_database_up 1';
      mockHealthService.getMetrics.mockResolvedValue(mockMetrics);

      await healthController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockHealthService.getMetrics).toHaveBeenCalledTimes(1);
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/plain; version=0.0.4; charset=utf-8'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.send).toHaveBeenCalledWith(mockMetrics);
    });

    it('should handle metrics generation errors', async () => {
      mockHealthService.getMetrics.mockRejectedValue(new Error('Metrics error'));

      await healthController.getMetrics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to generate metrics',
          message: 'Metrics error',
        })
      );
    });
  });

  describe('getInstanceHealth', () => {
    it('should return instance health details', async () => {
      mockHealthService.getHealthStatus.mockResolvedValue(mockHealthyStatus);

      await healthController.getInstanceHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: mockHealthyStatus.instances,
          details: [],
        })
      );
    });

    it('should handle instance health check errors', async () => {
      mockHealthService.getHealthStatus.mockRejectedValue(new Error('Instance error'));

      await healthController.getInstanceHealth(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Failed to get instance health',
          message: 'Instance error',
        })
      );
    });
  });
});
