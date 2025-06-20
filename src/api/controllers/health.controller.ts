import { Request, Response } from 'express';
import { HealthService, HealthStatus } from '@api/services/health.service';
import { Logger } from '@config/logger.config';

export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  /**
   * @route GET /health
   * @description Get system health status
   * @returns {HealthStatus} System health information
   */
  async getHealth(request: Request, response: Response): Promise<Response<HealthStatus>> {
    try {
      const healthStatus = await this.healthService.getHealthStatus();
      
      // Set appropriate HTTP status code based on health
      const httpStatus = this.getHttpStatusFromHealth(healthStatus.status);
      
      this.logger.debug('Health check requested', {
        status: healthStatus.status,
        uptime: healthStatus.uptime,
        instances: healthStatus.instances.total,
      });

      return response.status(httpStatus).json(healthStatus);
    } catch (error) {
      this.logger.error('Health check failed', error);
      
      const errorResponse: HealthStatus = {
        status: 'unhealthy',
        version: process.env.npm_package_version || '2.3.0',
        timestamp: new Date().toISOString(),
        uptime: 0,
        database: { status: 'error', error: 'Health check failed' },
        redis: { status: 'error', error: 'Health check failed' },
        instances: { total: 0, active: 0, inactive: 0 },
        memory: { used: 0, total: 0, percentage: 0 },
        system: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      };

      return response.status(503).json(errorResponse);
    }
  }

  /**
   * @route GET /health/ready
   * @description Kubernetes readiness probe endpoint
   * @returns {object} Simple ready status
   */
  async getReadiness(request: Request, response: Response): Promise<Response> {
    try {
      const healthStatus = await this.healthService.getHealthStatus();
      
      // Ready if database is connected (minimum requirement)
      const isReady = healthStatus.database.status === 'connected';
      
      if (isReady) {
        return response.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
        });
      } else {
        return response.status(503).json({
          status: 'not ready',
          reason: 'Database not connected',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error('Readiness check failed', error);
      
      return response.status(503).json({
        status: 'not ready',
        reason: 'Health check failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * @route GET /health/live
   * @description Kubernetes liveness probe endpoint
   * @returns {object} Simple alive status
   */
  async getLiveness(request: Request, response: Response): Promise<Response> {
    try {
      // Liveness is simpler - just check if the application is running
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      
      return response.status(200).json({
        status: 'alive',
        uptime: Math.floor(uptime),
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Liveness check failed', error);
      
      return response.status(503).json({
        status: 'not alive',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * @route GET /metrics
   * @description Prometheus metrics endpoint
   * @returns {string} Prometheus formatted metrics
   */
  async getMetrics(request: Request, response: Response): Promise<Response> {
    try {
      const metrics = await this.healthService.getMetrics();
      
      // Set content type for Prometheus
      response.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      
      return response.status(200).send(metrics);
    } catch (error) {
      this.logger.error('Metrics generation failed', error);
      
      return response.status(500).json({
        error: 'Failed to generate metrics',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * @route GET /health/instances
   * @description Get detailed instance health information
   * @returns {object} Instance health details
   */
  async getInstanceHealth(request: Request, response: Response): Promise<Response> {
    try {
      const healthStatus = await this.healthService.getHealthStatus();
      
      // Get more detailed instance information
      const instanceDetails = {
        summary: healthStatus.instances,
        timestamp: new Date().toISOString(),
        details: [], // Can be extended to include per-instance details
      };

      return response.status(200).json(instanceDetails);
    } catch (error) {
      this.logger.error('Instance health check failed', error);
      
      return response.status(500).json({
        error: 'Failed to get instance health',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Convert health status to appropriate HTTP status code
   */
  private getHttpStatusFromHealth(status: HealthStatus['status']): number {
    switch (status) {
      case 'healthy':
        return 200;
      case 'degraded':
        return 200; // Still operational, but with warnings
      case 'unhealthy':
        return 503; // Service unavailable
      default:
        return 503;
    }
  }
}
