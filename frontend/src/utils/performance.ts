// Performance monitoring utilities

interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'score' | 'count'
  timestamp: number
  page?: string
  component?: string
}

interface WebVitalsMetric {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private vitals: WebVitalsMetric[] = []
  private observers: PerformanceObserver[] = []

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers()
      this.measureInitialLoad()
    }
  }

  private initializeObservers() {
    // Performance Observer for navigation timing
    if ('PerformanceObserver' in window) {
      try {
        const navObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              this.processNavigationEntry(entry as PerformanceNavigationTiming)
            }
          }
        })
        navObserver.observe({ entryTypes: ['navigation'] })
        this.observers.push(navObserver)

        // Performance Observer for resource timing
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              this.processResourceEntry(entry as PerformanceResourceTiming)
            }
          }
        })
        resourceObserver.observe({ entryTypes: ['resource'] })
        this.observers.push(resourceObserver)

        // Performance Observer for paint timing
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'paint') {
              this.processPaintEntry(entry)
            }
          }
        })
        paintObserver.observe({ entryTypes: ['paint'] })
        this.observers.push(paintObserver)

        // Performance Observer for largest contentful paint
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1]
          if (lastEntry) {
            this.addWebVital('LCP', lastEntry.startTime)
          }
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
        this.observers.push(lcpObserver)

        // Performance Observer for first input delay
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'first-input') {
              const fidEntry = entry as any
              this.addWebVital('FID', fidEntry.processingStart - fidEntry.startTime)
            }
          }
        })
        fidObserver.observe({ entryTypes: ['first-input'] })
        this.observers.push(fidObserver)

      } catch (e) {
        console.warn('Performance Observer not fully supported:', e)
      }
    }
  }

  private measureInitialLoad() {
    // Measure bundle size (approximate)
    const bundleSize = this.estimateBundleSize()
    this.addMetric('bundle-size', bundleSize, 'bytes')

    // Measure memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.addMetric('memory-used', memory.usedJSHeapSize, 'bytes')
      this.addMetric('memory-total', memory.totalJSHeapSize, 'bytes')
      this.addMetric('memory-limit', memory.jsHeapSizeLimit, 'bytes')
    }
  }

  private processNavigationEntry(entry: PerformanceNavigationTiming) {
    // Time to first byte
    const ttfb = entry.responseStart - entry.requestStart
    this.addWebVital('TTFB', ttfb)

    // DNS lookup time
    this.addMetric('dns-lookup', entry.domainLookupEnd - entry.domainLookupStart, 'ms')

    // Connection time
    this.addMetric('connection', entry.connectEnd - entry.connectStart, 'ms')

    // Server response time
    this.addMetric('server-response', entry.responseEnd - entry.responseStart, 'ms')

    // DOM processing time
    this.addMetric('dom-processing', entry.domComplete - entry.responseEnd, 'ms')

    // Total load time
    this.addMetric('total-load', entry.loadEventEnd - entry.navigationStart, 'ms')
  }

  private processResourceEntry(entry: PerformanceResourceTiming) {
    // Track large resources
    if (entry.transferSize > 100000) { // > 100KB
      this.addMetric(
        `large-resource-${this.getResourceType(entry.name)}`,
        entry.transferSize,
        'bytes'
      )
    }

    // Track slow resources
    const loadTime = entry.responseEnd - entry.requestStart
    if (loadTime > 1000) { // > 1 second
      this.addMetric(
        `slow-resource-${this.getResourceType(entry.name)}`,
        loadTime,
        'ms'
      )
    }
  }

  private processPaintEntry(entry: PerformanceEntry) {
    if (entry.name === 'first-contentful-paint') {
      this.addWebVital('FCP', entry.startTime)
    }
  }

  private getResourceType(url: string): string {
    if (url.includes('.js')) return 'javascript'
    if (url.includes('.css')) return 'stylesheet'
    if (url.includes('.png') || url.includes('.jpg') || url.includes('.svg')) return 'image'
    if (url.includes('.woff') || url.includes('.ttf')) return 'font'
    return 'other'
  }

  private estimateBundleSize(): number {
    // Estimate based on script tags and loaded resources
    const scripts = document.querySelectorAll('script[src]')
    let estimatedSize = 0
    
    // Rough estimation - in a real app you'd get this from webpack stats
    scripts.forEach((script) => {
      const src = (script as HTMLScriptElement).src
      if (src.includes('_next/static')) {
        estimatedSize += 50000 // Estimate 50KB per chunk
      }
    })
    
    return estimatedSize || 200000 // Default estimate
  }

  public addMetric(name: string, value: number, unit: PerformanceMetric['unit'], component?: string) {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now(),
      page: window.location.pathname,
      component
    })
  }

  public addWebVital(name: WebVitalsMetric['name'], value: number) {
    const rating = this.getRating(name, value)
    this.vitals.push({
      name,
      value,
      rating,
      timestamp: Date.now()
    })
  }

  private getRating(name: WebVitalsMetric['name'], value: number): WebVitalsMetric['rating'] {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    }

    const threshold = thresholds[name]
    if (value <= threshold.good) return 'good'
    if (value <= threshold.poor) return 'needs-improvement'
    return 'poor'
  }

  public measureComponentRender(componentName: string, renderFn: () => void) {
    const startTime = performance.now()
    renderFn()
    const endTime = performance.now()
    
    this.addMetric(`${componentName}-render`, endTime - startTime, 'ms', componentName)
  }

  public measureAsync<T>(name: string, asyncFn: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    return asyncFn().finally(() => {
      const endTime = performance.now()
      this.addMetric(name, endTime - startTime, 'ms')
    })
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  public getWebVitals(): WebVitalsMetric[] {
    return [...this.vitals]
  }

  public getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink
      } : undefined,
      metrics: this.getMetrics(),
      webVitals: this.getWebVitals(),
      summary: this.generateSummary()
    }

    return report
  }

  private generateSummary() {
    const vitals = this.getWebVitals()
    const metrics = this.getMetrics()

    return {
      webVitalsScore: vitals.filter(v => v.rating === 'good').length / Math.max(vitals.length, 1),
      totalMetrics: metrics.length,
      averageRenderTime: this.getAverageRenderTime(),
      largestBundle: this.getLargestBundle(),
      memoryUsage: this.getCurrentMemoryUsage()
    }
  }

  private getAverageRenderTime(): number {
    const renderMetrics = this.metrics.filter(m => m.name.includes('-render'))
    if (renderMetrics.length === 0) return 0
    
    return renderMetrics.reduce((sum, m) => sum + m.value, 0) / renderMetrics.length
  }

  private getLargestBundle(): number {
    const bundleMetrics = this.metrics.filter(m => m.name.includes('bundle'))
    return Math.max(...bundleMetrics.map(m => m.value), 0)
  }

  private getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }

  public cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect()
      } catch (e) {
        console.warn('Error disconnecting performance observer:', e)
      }
    })
    this.observers = []
  }
}

// Global instance
export const performanceMonitor = new PerformanceMonitor()

// Hook for React components
export function usePerformanceMetrics() {
  return {
    addMetric: (name: string, value: number, unit: PerformanceMetric['unit'], component?: string) =>
      performanceMonitor.addMetric(name, value, unit, component),
    measureRender: (componentName: string, renderFn: () => void) =>
      performanceMonitor.measureComponentRender(componentName, renderFn),
    measureAsync: <T>(name: string, asyncFn: () => Promise<T>) =>
      performanceMonitor.measureAsync(name, asyncFn),
    getReport: () => performanceMonitor.getPerformanceReport()
  }
}

// Bundle size monitoring
export function monitorBundleSize() {
  if (typeof window === 'undefined') return

  // Monitor dynamic imports
  const originalImport = window.import || (() => Promise.resolve())
  // @ts-ignore
  window.import = function(...args) {
    const startTime = performance.now()
    return originalImport.apply(this, args).then((module) => {
      const loadTime = performance.now() - startTime
      performanceMonitor.addMetric('dynamic-import', loadTime, 'ms')
      return module
    })
  }
}

// Memory leak detection
export function detectMemoryLeaks() {
  if (typeof window === 'undefined' || !('memory' in performance)) return

  const memory = (performance as any).memory
  let lastMemoryCheck = memory.usedJSHeapSize
  
  setInterval(() => {
    const currentMemory = memory.usedJSHeapSize
    const memoryDiff = currentMemory - lastMemoryCheck
    
    if (memoryDiff > 10 * 1024 * 1024) { // 10MB increase
      performanceMonitor.addMetric('memory-leak-warning', memoryDiff, 'bytes')
      console.warn('Potential memory leak detected:', {
        increase: `${(memoryDiff / 1024 / 1024).toFixed(2)}MB`,
        total: `${(currentMemory / 1024 / 1024).toFixed(2)}MB`
      })
    }
    
    lastMemoryCheck = currentMemory
  }, 30000) // Check every 30 seconds
}