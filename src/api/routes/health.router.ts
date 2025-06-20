import { Router } from 'express';
import { HealthController } from '@api/controllers/health.controller';
import { HealthService } from '@api/services/health.service';
import { ConfigService } from '@config/env.config';
import { PrismaRepository } from '@api/repository/repository.service';
import { CacheService } from '@api/services/cache.service';
import { WAMonitoringService } from '@api/services/monitor.service';

export class HealthRouter {
  public readonly router: Router;
  private readonly healthController: HealthController;

  constructor(
    configService: ConfigService,
    prismaRepository: PrismaRepository,
    cacheService: CacheService,
    waMonitoringService: WAMonitoringService,
  ) {
    this.router = Router();
    
    // Create health service and controller
    const healthService = new HealthService(
      configService,
      prismaRepository,
      cacheService,
      waMonitoringService,
    );
    this.healthController = new HealthController(healthService);

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Main health check endpoint
    this.router.get('/health', (req, res) => 
      this.healthController.getHealth(req, res)
    );

    // Kubernetes readiness probe
    this.router.get('/health/ready', (req, res) => 
      this.healthController.getReadiness(req, res)
    );

    // Kubernetes liveness probe
    this.router.get('/health/live', (req, res) => 
      this.healthController.getLiveness(req, res)
    );

    // Instance health details
    this.router.get('/health/instances', (req, res) => 
      this.healthController.getInstanceHealth(req, res)
    );

    // Prometheus metrics endpoint
    this.router.get('/metrics', (req, res) => 
      this.healthController.getMetrics(req, res)
    );
  }
}
