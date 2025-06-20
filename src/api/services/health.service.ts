import { ConfigService } from '@config/env.config';
import { PrismaRepository } from '@api/repository/repository.service';
import { CacheService } from '@api/services/cache.service';
import { WAMonitoringService } from '@api/services/monitor.service';
import { Logger } from '@config/logger.config';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  version: string;
  timestamp: string;
  uptime: number;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    responseTime?: number;
    error?: string;
  };
  redis: {
    status: 'connected' | 'disconnected' | 'disabled' | 'error';
    responseTime?: number;
    error?: string;
  };
  instances: {
    total: number;
    active: number;
    inactive: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
  };
}

export interface MetricsData {
  // System metrics
  system_uptime_seconds: number;
  system_memory_usage_bytes: number;
  system_memory_total_bytes: number;
  
  // Application metrics
  app_instances_total: number;
  app_instances_active: number;
  app_instances_inactive: number;
  
  // Database metrics
  database_connection_status: number; // 1 = connected, 0 = disconnected
  database_response_time_ms: number;
  
  // Redis metrics
  redis_connection_status: number; // 1 = connected, 0 = disconnected
  redis_response_time_ms: number;
  
  // HTTP metrics (can be extended)
  http_requests_total?: number;
  http_request_duration_ms?: number;
}

export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private startTime: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaRepository: PrismaRepository,
    private readonly cache: CacheService,
    private readonly waMonitor: WAMonitoringService,
  ) {
    this.startTime = Date.now();
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check database health
      const databaseHealth = await this.checkDatabaseHealth();
      
      // Check Redis health
      const redisHealth = await this.checkRedisHealth();
      
      // Get instance statistics
      const instanceStats = await this.getInstanceStatistics();
      
      // Get memory usage
      const memoryUsage = this.getMemoryUsage();
      
      // Get system information
      const systemInfo = this.getSystemInfo();
      
      // Determine overall status
      const overallStatus = this.determineOverallStatus(databaseHealth, redisHealth);
      
      const healthStatus: HealthStatus = {
        status: overallStatus,
        version: process.env.npm_package_version || '2.3.0',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        database: databaseHealth,
        redis: redisHealth,
        instances: instanceStats,
        memory: memoryUsage,
        system: systemInfo,
      };

      this.logger.debug({
        message: 'Health check completed',
        status: overallStatus,
        duration: Date.now() - startTime,
      });

      return healthStatus;
    } catch (error) {
      this.logger.error({ message: 'Health check failed', error: error.message });
      
      return {
        status: 'unhealthy',
        version: process.env.npm_package_version || '2.3.0',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        database: { status: 'error', error: error.message },
        redis: { status: 'error', error: error.message },
        instances: { total: 0, active: 0, inactive: 0 },
        memory: this.getMemoryUsage(),
        system: this.getSystemInfo(),
      };
    }
  }

  async getMetrics(): Promise<string> {
    try {
      const healthStatus = await this.getHealthStatus();
      const metrics: MetricsData = {
        system_uptime_seconds: healthStatus.uptime,
        system_memory_usage_bytes: healthStatus.memory.used,
        system_memory_total_bytes: healthStatus.memory.total,
        app_instances_total: healthStatus.instances.total,
        app_instances_active: healthStatus.instances.active,
        app_instances_inactive: healthStatus.instances.inactive,
        database_connection_status: healthStatus.database.status === 'connected' ? 1 : 0,
        database_response_time_ms: healthStatus.database.responseTime || 0,
        redis_connection_status: healthStatus.redis.status === 'connected' ? 1 : 0,
        redis_response_time_ms: healthStatus.redis.responseTime || 0,
      };

      // Convert to Prometheus format
      return this.formatPrometheusMetrics(metrics);
    } catch (error) {
      this.logger.error({ message: 'Failed to generate metrics', error: error.message });
      throw error;
    }
  }

  private async checkDatabaseHealth(): Promise<HealthStatus['database']> {
    const startTime = Date.now();
    
    try {
      // Simple query to check database connectivity
      await this.prismaRepository.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime,
      };
    } catch (error) {
      this.logger.error({ message: 'Database health check failed', error: error.message });
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async checkRedisHealth(): Promise<HealthStatus['redis']> {
    const redisConfig = this.configService.get('CACHE').REDIS;
    
    if (!redisConfig.ENABLED) {
      return { status: 'disabled' };
    }

    const startTime = Date.now();
    
    try {
      // Check Redis connectivity with a simple ping
      const testKey = 'health_check_' + Date.now();
      await this.cache.set(testKey, 'test', 1); // 1 second TTL
      await this.cache.get(testKey);
      await this.cache.delete(testKey);
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'connected',
        responseTime,
      };
    } catch (error) {
      this.logger.error({ message: 'Redis health check failed', error: error.message });
      
      return {
        status: 'error',
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async getInstanceStatistics(): Promise<HealthStatus['instances']> {
    try {
      const instances = Object.keys(this.waMonitor.waInstances);
      const total = instances.length;
      
      let active = 0;
      let inactive = 0;
      
      for (const instanceName of instances) {
        const instance = this.waMonitor.waInstances[instanceName];
        if (instance?.connectionStatus?.state === 'open') {
          active++;
        } else {
          inactive++;
        }
      }
      
      return { total, active, inactive };
    } catch (error) {
      this.logger.error({ message: 'Failed to get instance statistics', error: error.message });
      return { total: 0, active: 0, inactive: 0 };
    }
  }

  private getMemoryUsage(): HealthStatus['memory'] {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal + memUsage.external;
    const usedMemory = memUsage.heapUsed;
    
    return {
      used: usedMemory,
      total: totalMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };
  }

  private getSystemInfo(): HealthStatus['system'] {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };
  }

  private determineOverallStatus(
    databaseHealth: HealthStatus['database'],
    redisHealth: HealthStatus['redis'],
  ): HealthStatus['status'] {
    // Critical: Database must be connected
    if (databaseHealth.status !== 'connected') {
      return 'unhealthy';
    }
    
    // Degraded: Redis issues (if enabled)
    if (redisHealth.status === 'error') {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private formatPrometheusMetrics(metrics: MetricsData): string {
    const lines: string[] = [];
    
    // Add help and type information
    lines.push('# HELP evolution_api_uptime_seconds Total uptime of the application in seconds');
    lines.push('# TYPE evolution_api_uptime_seconds counter');
    lines.push(`evolution_api_uptime_seconds ${metrics.system_uptime_seconds}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_memory_usage_bytes Current memory usage in bytes');
    lines.push('# TYPE evolution_api_memory_usage_bytes gauge');
    lines.push(`evolution_api_memory_usage_bytes ${metrics.system_memory_usage_bytes}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_instances_total Total number of WhatsApp instances');
    lines.push('# TYPE evolution_api_instances_total gauge');
    lines.push(`evolution_api_instances_total ${metrics.app_instances_total}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_instances_active Number of active WhatsApp instances');
    lines.push('# TYPE evolution_api_instances_active gauge');
    lines.push(`evolution_api_instances_active ${metrics.app_instances_active}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_database_up Database connection status (1 = up, 0 = down)');
    lines.push('# TYPE evolution_api_database_up gauge');
    lines.push(`evolution_api_database_up ${metrics.database_connection_status}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_database_response_time_ms Database response time in milliseconds');
    lines.push('# TYPE evolution_api_database_response_time_ms gauge');
    lines.push(`evolution_api_database_response_time_ms ${metrics.database_response_time_ms}`);
    lines.push('');
    
    lines.push('# HELP evolution_api_redis_up Redis connection status (1 = up, 0 = down)');
    lines.push('# TYPE evolution_api_redis_up gauge');
    lines.push(`evolution_api_redis_up ${metrics.redis_connection_status}`);
    lines.push('');
    
    return lines.join('\n');
  }
}
