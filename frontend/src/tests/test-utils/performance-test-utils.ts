import { Page } from '@playwright/test'
import { render } from '@testing-library/react'
import { ReactElement } from 'react'

// Performance metrics thresholds
export const PERFORMANCE_THRESHOLDS = {
  renderTime: 50, // ms
  reRenderTime: 20, // ms
  memoryUsage: 50 * 1024 * 1024, // 50MB
  bundleSize: 500 * 1024, // 500KB
  firstContentfulPaint: 1000, // ms
  largestContentfulPaint: 2500, // ms
  timeToInteractive: 3000, // ms
  cumulativeLayoutShift: 0.1,
  firstInputDelay: 100, // ms
}

// React component performance testing
export class ComponentPerformanceTester {
  private measurements: Map<string, number[]> = new Map()

  measureRender(name: string, component: ReactElement) {
    const start = performance.now()
    const { unmount } = render(component)
    const end = performance.now()
    const duration = end - start

    this.addMeasurement(`${name}-render`, duration)
    unmount()
    
    return duration
  }

  measureReRender(name: string, component: ReactElement, updateProps: () => void) {
    const { rerender, unmount } = render(component)
    
    // Initial render
    const initialStart = performance.now()
    rerender(component)
    const initialEnd = performance.now()
    
    // Update and re-render
    updateProps()
    const reRenderStart = performance.now()
    rerender(component)
    const reRenderEnd = performance.now()
    
    const reRenderDuration = reRenderEnd - reRenderStart
    this.addMeasurement(`${name}-rerender`, reRenderDuration)
    
    unmount()
    return {
      initial: initialEnd - initialStart,
      reRender: reRenderDuration,
    }
  }

  measureMemoryUsage(name: string, callback: () => void) {
    if (!performance.memory) {
      console.warn('Performance.memory API not available')
      return null
    }

    const before = performance.memory.usedJSHeapSize
    callback()
    const after = performance.memory.usedJSHeapSize
    const usage = after - before

    this.addMeasurement(`${name}-memory`, usage)
    return usage
  }

  private addMeasurement(key: string, value: number) {
    if (!this.measurements.has(key)) {
      this.measurements.set(key, [])
    }
    this.measurements.get(key)!.push(value)
  }

  getStats(key: string) {
    const values = this.measurements.get(key) || []
    if (values.length === 0) return null

    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: values.length,
    }
  }

  generateReport() {
    const report: Record<string, any> = {}
    
    for (const [key, values] of this.measurements) {
      report[key] = this.getStats(key)
    }
    
    return report
  }

  assertPerformance(threshold: number, metric: string) {
    const stats = this.getStats(metric)
    if (!stats) {
      throw new Error(`No measurements found for ${metric}`)
    }
    
    expect(stats.avg).toBeLessThan(threshold)
    expect(stats.p95).toBeLessThan(threshold * 1.5)
  }
}

// E2E performance testing with Playwright
export class E2EPerformanceTester {
  constructor(private page: Page) {}

  async measurePageLoad(url: string) {
    await this.page.goto(url, { waitUntil: 'networkidle' })
    
    const metrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      const paint = performance.getEntriesByType('paint')
      
      return {
        // Navigation timing
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        
        // Paint timing
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        
        // Resource timing
        resourceCount: performance.getEntriesByType('resource').length,
        totalResourceSize: performance.getEntriesByType('resource')
          .reduce((sum, r: any) => sum + (r.transferSize || 0), 0),
      }
    })
    
    return metrics
  }

  async measureInteraction(selector: string, action: 'click' | 'type', value?: string) {
    const start = await this.page.evaluate(() => performance.now())
    
    if (action === 'click') {
      await this.page.click(selector)
    } else if (action === 'type' && value) {
      await this.page.type(selector, value)
    }
    
    await this.page.waitForLoadState('networkidle')
    
    const end = await this.page.evaluate(() => performance.now())
    return end - start
  }

  async measureWebVitals() {
    return await this.page.evaluate(() => {
      return new Promise((resolve) => {
        let lcp = 0
        let fid = 0
        let cls = 0
        let fcp = 0
        let ttfb = 0

        // Largest Contentful Paint
        new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          lcp = entries[entries.length - 1].startTime
        }).observe({ entryTypes: ['largest-contentful-paint'] })

        // First Input Delay
        new PerformanceObserver((entryList) => {
          const firstInput = entryList.getEntries()[0]
          fid = firstInput.processingStart - firstInput.startTime
        }).observe({ entryTypes: ['first-input'] })

        // Cumulative Layout Shift
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              cls += (entry as any).value
            }
          }
        }).observe({ entryTypes: ['layout-shift'] })

        // First Contentful Paint
        const paintEntries = performance.getEntriesByType('paint')
        fcp = paintEntries.find(p => p.name === 'first-contentful-paint')?.startTime || 0

        // Time to First Byte
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        ttfb = nav.responseStart - nav.requestStart

        // Wait a bit for metrics to be collected
        setTimeout(() => {
          resolve({ lcp, fid, cls, fcp, ttfb })
        }, 3000)
      })
    })
  }

  async profileJavaScript(duration: number = 5000) {
    await this.page.coverage.startJSCoverage()
    
    await this.page.waitForTimeout(duration)
    
    const coverage = await this.page.coverage.stopJSCoverage()
    
    const totalBytes = coverage.reduce((sum, entry) => sum + entry.text.length, 0)
    const usedBytes = coverage.reduce((sum, entry) => 
      sum + entry.ranges.reduce((s, r) => s + (r.end - r.start), 0), 0
    )
    
    return {
      totalBytes,
      usedBytes,
      unusedBytes: totalBytes - usedBytes,
      percentageUsed: (usedBytes / totalBytes) * 100,
    }
  }

  async measureMemoryUsage() {
    return await this.page.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
        }
      }
      return null
    })
  }

  async generateLighthouseReport(url: string) {
    // This would integrate with Lighthouse CI
    // For now, we'll return a mock structure
    return {
      performance: 0,
      accessibility: 0,
      bestPractices: 0,
      seo: 0,
      pwa: 0,
    }
  }
}

// Performance assertion helpers
export function expectPerformanceWithin(actual: number, expected: number, tolerance: number = 0.1) {
  const min = expected * (1 - tolerance)
  const max = expected * (1 + tolerance)
  expect(actual).toBeGreaterThanOrEqual(min)
  expect(actual).toBeLessThanOrEqual(max)
}

export function expectWebVitalsToPass(metrics: any) {
  expect(metrics.lcp).toBeLessThan(PERFORMANCE_THRESHOLDS.largestContentfulPaint)
  expect(metrics.fid).toBeLessThan(PERFORMANCE_THRESHOLDS.firstInputDelay)
  expect(metrics.cls).toBeLessThan(PERFORMANCE_THRESHOLDS.cumulativeLayoutShift)
  expect(metrics.fcp).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint)
}