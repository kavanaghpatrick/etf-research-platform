import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      message?: string;
      responseTime?: number;
    };
  };
}

// Track application start time
const startTime = Date.now();

async function checkDatabase(): Promise<{ status: 'pass' | 'fail'; message?: string; responseTime: number }> {
  const start = Date.now();
  try {
    // Placeholder for database health check
    // In a real application, this would check database connectivity
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Database check failed',
      responseTime: Date.now() - start,
    };
  }
}

async function checkAPI(): Promise<{ status: 'pass' | 'fail'; message?: string; responseTime: number }> {
  const start = Date.now();
  try {
    // Check if API base URL is configured
    if (!process.env.API_BASE_URL) {
      throw new Error('API_BASE_URL not configured');
    }
    
    // In production, you might want to make a simple API call here
    return {
      status: 'pass',
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: error instanceof Error ? error.message : 'API check failed',
      responseTime: Date.now() - start,
    };
  }
}

async function checkMemory(): Promise<{ status: 'pass' | 'fail'; message?: string }> {
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryThreshold = 0.9; // 90% threshold
    
    if (heapUsedMB / heapTotalMB > memoryThreshold) {
      return {
        status: 'fail',
        message: `Memory usage high: ${heapUsedMB}MB / ${heapTotalMB}MB`,
      };
    }
    
    return {
      status: 'pass',
      message: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`,
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Memory check failed',
    };
  }
}

export async function GET() {
  try {
    // Run health checks in parallel
    const [dbCheck, apiCheck, memoryCheck] = await Promise.all([
      checkDatabase(),
      checkAPI(),
      checkMemory(),
    ]);
    
    // Calculate overall status
    const checks = {
      database: dbCheck,
      api: apiCheck,
      memory: memoryCheck,
    };
    
    const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (failedChecks === 0) {
      status = 'healthy';
    } else if (failedChecks === 1) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }
    
    const response: HealthCheckResponse = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.BUILD_VERSION || process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown',
      uptime: Math.floor((Date.now() - startTime) / 1000), // in seconds
      checks,
    };
    
    // Log health check
    if (status !== 'healthy') {
      logger.warn('Health check detected issues', { response });
    }
    
    // Return appropriate status code
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    
    return NextResponse.json(response, { status: statusCode });
  } catch (error) {
    logger.error('Health check failed', error as Error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: 'unknown',
        uptime: 0,
        checks: {},
        error: 'Health check failed',
      },
      { status: 503 }
    );
  }
}