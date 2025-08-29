// Application Performance Monitoring (APM) and alerting utilities
import { logger } from './logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
  tags?: Record<string, string>;
}

// Performance thresholds
const THRESHOLDS = {
  PAGE_LOAD_TIME: 3000, // 3 seconds
  API_RESPONSE_TIME: 1000, // 1 second
  MEMORY_USAGE_PERCENT: 80, // 80%
  ERROR_RATE_PERCENT: 5, // 5%
  CRASH_FREE_RATE: 99.5, // 99.5%
};

class Monitoring {
  private static instance: Monitoring;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: Alert[] = [];
  private isProduction = process.env.NODE_ENV === 'production';

  private constructor() {
    this.initializeMonitoring();
  }

  static getInstance(): Monitoring {
    if (!Monitoring.instance) {
      Monitoring.instance = new Monitoring();
    }
    return Monitoring.instance;
  }

  private initializeMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Client-side monitoring
      this.setupWebVitalsMonitoring();
      this.setupErrorMonitoring();
      this.setupResourceMonitoring();
    } else {
      // Server-side monitoring
      this.setupServerMonitoring();
    }
  }

  // Web Vitals monitoring (client-side)
  private setupWebVitalsMonitoring(): void {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric({
            name: 'web_vitals_lcp',
            value: lastEntry.startTime,
            unit: 'ms',
            tags: { page: window.location.pathname },
          });

          if (lastEntry.startTime > 2500) {
            this.createAlert({
              level: 'warning',
              title: 'Slow LCP detected',
              message: `LCP of ${lastEntry.startTime}ms exceeds threshold`,
              metric: 'web_vitals_lcp',
              value: lastEntry.startTime,
              threshold: 2500,
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // LCP not supported
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordMetric({
              name: 'web_vitals_fid',
              value: entry.processingStart - entry.startTime,
              unit: 'ms',
              tags: { page: window.location.pathname },
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // FID not supported
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        let clsEntries: any[] = [];

        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              const firstSessionEntry = clsEntries[0];
              const lastSessionEntry = clsEntries[clsEntries.length - 1];

              if (
                entry.startTime - lastSessionEntry.startTime < 1000 &&
                entry.startTime - firstSessionEntry.startTime < 5000
              ) {
                clsValue += entry.value;
                clsEntries.push(entry);
              } else {
                clsValue = entry.value;
                clsEntries = [entry];
              }
            }
          }

          this.recordMetric({
            name: 'web_vitals_cls',
            value: clsValue,
            unit: 'score',
            tags: { page: window.location.pathname },
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // CLS not supported
      }
    }
  }

  // Error monitoring
  private setupErrorMonitoring(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.recordMetric({
          name: 'client_error',
          value: 1,
          unit: 'count',
          tags: {
            message: event.message,
            source: event.filename || 'unknown',
            line: String(event.lineno || 0),
            column: String(event.colno || 0),
          },
        });

        this.createAlert({
          level: 'error',
          title: 'Client-side error',
          message: event.message,
          tags: {
            source: event.filename || 'unknown',
            line: String(event.lineno || 0),
          },
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.recordMetric({
          name: 'unhandled_rejection',
          value: 1,
          unit: 'count',
          tags: {
            reason: String(event.reason),
          },
        });
      });
    }
  }

  // Resource monitoring
  private setupResourceMonitoring(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // Monitor page load time
      window.addEventListener('load', () => {
        const perfData = performance.getEntriesByType('navigation')[0] as any;
        if (perfData) {
          const pageLoadTime = perfData.loadEventEnd - perfData.fetchStart;
          this.recordMetric({
            name: 'page_load_time',
            value: pageLoadTime,
            unit: 'ms',
            tags: { page: window.location.pathname },
          });

          if (pageLoadTime > THRESHOLDS.PAGE_LOAD_TIME) {
            this.createAlert({
              level: 'warning',
              title: 'Slow page load',
              message: `Page load time of ${pageLoadTime}ms exceeds threshold`,
              metric: 'page_load_time',
              value: pageLoadTime,
              threshold: THRESHOLDS.PAGE_LOAD_TIME,
            });
          }
        }
      });

      // Monitor memory usage
      if ('memory' in performance) {
        setInterval(() => {
          const memory = (performance as any).memory;
          const usedMemoryMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
          const totalMemoryMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
          const memoryPercent = (usedMemoryMB / totalMemoryMB) * 100;

          this.recordMetric({
            name: 'memory_usage',
            value: usedMemoryMB,
            unit: 'MB',
            tags: { type: 'heap' },
          });

          if (memoryPercent > THRESHOLDS.MEMORY_USAGE_PERCENT) {
            this.createAlert({
              level: 'warning',
              title: 'High memory usage',
              message: `Memory usage at ${memoryPercent.toFixed(1)}%`,
              metric: 'memory_usage_percent',
              value: memoryPercent,
              threshold: THRESHOLDS.MEMORY_USAGE_PERCENT,
            });
          }
        }, 30000); // Check every 30 seconds
      }
    }
  }

  // Server-side monitoring
  private setupServerMonitoring(): void {
    // Monitor process metrics
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      this.recordMetric({
        name: 'server_memory_heap_used',
        value: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        unit: 'MB',
      });

      this.recordMetric({
        name: 'server_memory_rss',
        value: Math.round(memoryUsage.rss / 1024 / 1024),
        unit: 'MB',
      });

      const cpuUsage = process.cpuUsage();
      this.recordMetric({
        name: 'server_cpu_user',
        value: cpuUsage.user / 1000000, // Convert to seconds
        unit: 's',
      });
    }, 60000); // Every minute
  }

  // Record a metric
  recordMetric(metric: PerformanceMetric): void {
    const metricWithTimestamp = {
      ...metric,
      timestamp: metric.timestamp || Date.now(),
    };

    // Store locally
    const metrics = this.metrics.get(metric.name) || [];
    metrics.push(metricWithTimestamp);
    
    // Keep only last 100 metrics per name
    if (metrics.length > 100) {
      metrics.shift();
    }
    
    this.metrics.set(metric.name, metrics);

    // Send to monitoring service in production
    if (this.isProduction) {
      this.sendMetricToService(metricWithTimestamp);
    }

    // Log in development
    logger.debug(`Metric recorded: ${metric.name}`, { metric: metricWithTimestamp });
  }

  // Create an alert
  createAlert(alert: Alert): void {
    const alertWithTimestamp = {
      ...alert,
      timestamp: Date.now(),
    };

    this.alerts.push(alertWithTimestamp);

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Send alert in production
    if (this.isProduction) {
      this.sendAlertToService(alertWithTimestamp);
    }

    // Log alert
    const logMethod = alert.level === 'critical' ? 'fatal' : alert.level;
    logger[logMethod](alert.title, { alert: alertWithTimestamp });
  }

  // Send metric to monitoring service
  private sendMetricToService(metric: PerformanceMetric): void {
    const endpoint = process.env.NEXT_PUBLIC_MONITORING_ENDPOINT;
    if (!endpoint) return;

    // In a real implementation, this would send to services like:
    // - Datadog
    // - New Relic
    // - CloudWatch
    // - Prometheus
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metric', data: metric }),
    }).catch(() => {
      // Silently fail to avoid infinite loops
    });
  }

  // Send alert to service
  private sendAlertToService(alert: Alert & { timestamp: number }): void {
    const endpoint = process.env.NEXT_PUBLIC_ALERTING_ENDPOINT;
    if (!endpoint) return;

    // In a real implementation, this would send to services like:
    // - PagerDuty
    // - Slack
    // - Email
    // - SMS
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'alert', data: alert }),
    }).catch(() => {
      // Silently fail
    });
  }

  // Get metrics for a specific name
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  // Get all alerts
  getAlerts(): Alert[] {
    return this.alerts;
  }

  // Track custom timing
  startTiming(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric({
        name: `custom_timing_${label}`,
        value: duration,
        unit: 'ms',
      });
    };
  }

  // Track API call
  trackAPICall(
    method: string,
    url: string,
    status: number,
    duration: number
  ): void {
    this.recordMetric({
      name: 'api_response_time',
      value: duration,
      unit: 'ms',
      tags: {
        method,
        endpoint: url.replace(/\/\d+/g, '/:id'), // Normalize URLs
        status: String(status),
      },
    });

    if (duration > THRESHOLDS.API_RESPONSE_TIME) {
      this.createAlert({
        level: 'warning',
        title: 'Slow API response',
        message: `${method} ${url} took ${duration}ms`,
        metric: 'api_response_time',
        value: duration,
        threshold: THRESHOLDS.API_RESPONSE_TIME,
      });
    }

    if (status >= 500) {
      this.createAlert({
        level: 'error',
        title: 'API server error',
        message: `${method} ${url} returned ${status}`,
        tags: { method, url, status: String(status) },
      });
    }
  }
}

// Export singleton instance
export const monitoring = Monitoring.getInstance();

// Export convenience functions
export const recordMetric = (metric: PerformanceMetric) => monitoring.recordMetric(metric);
export const createAlert = (alert: Alert) => monitoring.createAlert(alert);
export const startTiming = (label: string) => monitoring.startTiming(label);
export const trackAPICall = (method: string, url: string, status: number, duration: number) =>
  monitoring.trackAPICall(method, url, status, duration);