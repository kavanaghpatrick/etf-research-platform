'use client';

import React, { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  renderTime?: number;
  componentCount?: number;
  memoryUsage?: number;
}

interface PerformanceMonitorProps {
  trackPageViews?: boolean;
  trackUserInteractions?: boolean;
  reportingEndpoint?: string;
  onMetricsCollected?: (metrics: PerformanceMetrics) => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  trackPageViews = true,
  trackUserInteractions = true,
  reportingEndpoint = '/api/performance',
  onMetricsCollected
}) => {
  const metricsRef = useRef<PerformanceMetrics>({});
  const observerRef = useRef<PerformanceObserver | null>(null);

  const sendMetrics = useCallback(async (metrics: PerformanceMetrics) => {
    try {
      // Call custom callback if provided
      if (onMetricsCollected) {
        onMetricsCollected(metrics);
      }

      // Send to reporting endpoint
      if (reportingEndpoint) {
        await fetch(reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...metrics,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            connectionType: (navigator as any).connection?.effectiveType || 'unknown'
          })
        });
      }
    } catch (error) {
      console.warn('Failed to send performance metrics:', error);
    }
  }, [reportingEndpoint, onMetricsCollected]);

  const measureWebVitals = useCallback(() => {
    // Measure Core Web Vitals
    if ('PerformanceObserver' in window) {
      try {
        // LCP (Largest Contentful Paint)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry;
          metricsRef.current.lcp = lastEntry.startTime;
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

        // FID (First Input Delay)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.processingStart && entry.startTime) {
              metricsRef.current.fid = entry.processingStart - entry.startTime;
            }
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });

        // CLS (Cumulative Layout Shift)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          metricsRef.current.cls = clsValue;
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });

        // FCP (First Contentful Paint)
        const navigationObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              metricsRef.current.fcp = entry.startTime;
            }
          });
        });
        navigationObserver.observe({ entryTypes: ['paint'] });

        observerRef.current = lcpObserver; // Store reference for cleanup
      } catch (error) {
        console.warn('Performance Observer not supported or failed:', error);
      }
    }

    // Measure Navigation Timing
    if ('performance' in window && 'timing' in window.performance) {
      const timing = window.performance.timing;
      metricsRef.current.ttfb = timing.responseStart - timing.fetchStart;
    }
  }, []);

  const measureComponentPerformance = useCallback(() => {
    // Measure React-specific performance
    const startTime = performance.now();
    
    // Count DOM nodes (approximate component count)
    const componentCount = document.querySelectorAll('*').length;
    metricsRef.current.componentCount = componentCount;

    // Measure memory usage if available
    if ('memory' in performance) {
      const memoryInfo = (performance as any).memory;
      metricsRef.current.memoryUsage = memoryInfo.usedJSHeapSize / 1024 / 1024; // MB
    }

    // Measure render time
    requestAnimationFrame(() => {
      const endTime = performance.now();
      metricsRef.current.renderTime = endTime - startTime;
    });
  }, []);

  const trackInteraction = useCallback((event: Event) => {
    const target = event.target as HTMLElement;
    const interaction = {
      type: event.type,
      target: target.tagName,
      timestamp: Date.now(),
      id: target.id || 'unknown',
      className: target.className || 'none'
    };

    // Track interaction latency
    const startTime = performance.now();
    requestAnimationFrame(() => {
      const latency = performance.now() - startTime;
      
      // Send interaction metrics
      sendMetrics({
        ...metricsRef.current,
        interactionLatency: latency,
        interactionType: interaction.type
      });
    });
  }, [sendMetrics]);

  useEffect(() => {
    if (trackPageViews) {
      measureWebVitals();
      measureComponentPerformance();

      // Send initial metrics after a delay
      const timeout = setTimeout(() => {
        sendMetrics(metricsRef.current);
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [trackPageViews, measureWebVitals, measureComponentPerformance, sendMetrics]);

  useEffect(() => {
    if (trackUserInteractions) {
      // Track key user interactions
      const events = ['click', 'keydown', 'scroll', 'touchstart'];
      
      events.forEach(eventType => {
        document.addEventListener(eventType, trackInteraction, { passive: true });
      });

      return () => {
        events.forEach(eventType => {
          document.removeEventListener(eventType, trackInteraction);
        });
      };
    }
  }, [trackUserInteractions, trackInteraction]);

  useEffect(() => {
    // Cleanup performance observers
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
};

// Hook for component-level performance monitoring
export const usePerformanceMonitoring = (componentName: string) => {
  const startTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  const startMeasure = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    const endTime = performance.now();
    const duration = endTime - startTimeRef.current;
    renderCountRef.current += 1;

    // Log performance in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} - Render ${renderCountRef.current}: ${duration.toFixed(2)}ms`);
    }

    return duration;
  }, [componentName]);

  const measureRender = useCallback((renderFunction: () => void) => {
    startMeasure();
    renderFunction();
    return endMeasure();
  }, [startMeasure, endMeasure]);

  return {
    startMeasure,
    endMeasure,
    measureRender,
    renderCount: renderCountRef.current
  };
};

// Performance thresholds for alerting
export const PERFORMANCE_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 },
  FID: { good: 100, needsImprovement: 300 },
  CLS: { good: 0.1, needsImprovement: 0.25 },
  FCP: { good: 1800, needsImprovement: 3000 },
  TTFB: { good: 800, needsImprovement: 1800 },
  RENDER_TIME: { good: 16, needsImprovement: 33 }, // 60fps = 16ms, 30fps = 33ms
  MEMORY_USAGE: { good: 50, needsImprovement: 100 } // MB
};

export const getPerformanceGrade = (metric: keyof typeof PERFORMANCE_THRESHOLDS, value: number): 'good' | 'needsImprovement' | 'poor' => {
  const threshold = PERFORMANCE_THRESHOLDS[metric];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsImprovement) return 'needsImprovement';
  return 'poor';
};

export default PerformanceMonitor;