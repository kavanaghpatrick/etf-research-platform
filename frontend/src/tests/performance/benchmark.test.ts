import { test, expect, Page } from '@playwright/test'
import { E2EPerformanceTester } from '@test-utils/performance-test-utils'

// Performance benchmarks based on Core Web Vitals
const PERFORMANCE_BENCHMARKS = {
  // Core Web Vitals
  LCP: { good: 2500, acceptable: 4000 }, // Largest Contentful Paint
  FID: { good: 100, acceptable: 300 },   // First Input Delay
  CLS: { good: 0.1, acceptable: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, acceptable: 3000 }, // First Contentful Paint
  TTFB: { good: 800, acceptable: 1800 }, // Time to First Byte
  
  // Custom metrics
  TTI: { good: 3800, acceptable: 7300 }, // Time to Interactive
  TBT: { good: 200, acceptable: 600 },   // Total Blocking Time
  SI: { good: 3400, acceptable: 5800 },  // Speed Index
  
  // Bundle metrics
  JS_BUNDLE: { good: 200000, acceptable: 500000 }, // 200KB / 500KB
  CSS_BUNDLE: { good: 50000, acceptable: 100000 }, // 50KB / 100KB
  TOTAL_SIZE: { good: 500000, acceptable: 1000000 }, // 500KB / 1MB
}

test.describe('Performance Benchmarking', () => {
  let performanceTester: E2EPerformanceTester;

  test.beforeEach(async ({ page }) => {
    performanceTester = new E2EPerformanceTester(page);
  });

  test.describe('Core Web Vitals Monitoring', () => {
    test('measures Core Web Vitals for homepage', async ({ page }) => {
      await page.goto('/')
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000) // Allow metrics to stabilize
      
      const webVitals = await performanceTester.measureWebVitals()
      
      console.log('Homepage Web Vitals:', {
        LCP: `${webVitals.lcp.toFixed(0)}ms`,
        FID: `${webVitals.fid.toFixed(0)}ms`,
        CLS: webVitals.cls.toFixed(3),
        FCP: `${webVitals.fcp.toFixed(0)}ms`,
        TTFB: `${webVitals.ttfb.toFixed(0)}ms`
      })
      
      // Assert Core Web Vitals
      expect(webVitals.lcp).toBeLessThan(PERFORMANCE_BENCHMARKS.LCP.acceptable)
      expect(webVitals.fid).toBeLessThan(PERFORMANCE_BENCHMARKS.FID.acceptable)
      expect(webVitals.cls).toBeLessThan(PERFORMANCE_BENCHMARKS.CLS.acceptable)
      expect(webVitals.fcp).toBeLessThan(PERFORMANCE_BENCHMARKS.FCP.acceptable)
      expect(webVitals.ttfb).toBeLessThan(PERFORMANCE_BENCHMARKS.TTFB.acceptable)
      
      // Flag if not meeting "good" thresholds
      const report = {
        passing: [] as string[],
        needsImprovement: [] as string[]
      }
      
      if (webVitals.lcp <= PERFORMANCE_BENCHMARKS.LCP.good) report.passing.push('LCP')
      else report.needsImprovement.push(`LCP (${webVitals.lcp.toFixed(0)}ms)`)
      
      if (webVitals.fid <= PERFORMANCE_BENCHMARKS.FID.good) report.passing.push('FID')
      else report.needsImprovement.push(`FID (${webVitals.fid.toFixed(0)}ms)`)
      
      if (webVitals.cls <= PERFORMANCE_BENCHMARKS.CLS.good) report.passing.push('CLS')
      else report.needsImprovement.push(`CLS (${webVitals.cls.toFixed(3)})`)
      
      console.log('Web Vitals Report:', report)
    })

    test('measures Core Web Vitals for stock detail page', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      
      const webVitals = await performanceTester.measureWebVitals()
      
      console.log('Stock Detail Web Vitals:', {
        LCP: `${webVitals.lcp.toFixed(0)}ms`,
        FID: `${webVitals.fid.toFixed(0)}ms`,
        CLS: webVitals.cls.toFixed(3),
        FCP: `${webVitals.fcp.toFixed(0)}ms`,
        TTFB: `${webVitals.ttfb.toFixed(0)}ms`
      })
      
      // Stock pages may have slightly relaxed thresholds due to data loading
      expect(webVitals.lcp).toBeLessThan(PERFORMANCE_BENCHMARKS.LCP.acceptable * 1.2)
      expect(webVitals.cls).toBeLessThan(PERFORMANCE_BENCHMARKS.CLS.acceptable)
    })

    test('tracks Web Vitals across navigation', async ({ page }) => {
      const vitalsHistory: any[] = []
      
      // Set up Web Vitals tracking
      await page.evaluateOnNewDocument(() => {
        window.vitalsHistory = []
        
        // Track CLS throughout page lifecycle
        new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!(entry as any).hadRecentInput) {
              window.vitalsHistory.push({
                metric: 'CLS',
                value: (entry as any).value,
                timestamp: Date.now()
              })
            }
          }
        }).observe({ entryTypes: ['layout-shift'] })
      })
      
      // Navigate through app
      await page.goto('/')
      await page.fill('input[placeholder*="ticker"]', 'AAPL')
      await page.press('input[placeholder*="ticker"]', 'Enter')
      await page.waitForSelector('[data-testid="results-dashboard"]')
      
      // Collect vitals history
      const history = await page.evaluate(() => window.vitalsHistory)
      
      // Analyze CLS throughout interaction
      const totalCLS = history
        .filter((v: any) => v.metric === 'CLS')
        .reduce((sum: number, v: any) => sum + v.value, 0)
      
      console.log(`Total CLS during navigation: ${totalCLS.toFixed(3)}`)
      expect(totalCLS).toBeLessThan(PERFORMANCE_BENCHMARKS.CLS.acceptable)
    })
  })

  test.describe('Bundle Size Impact', () => {
    test('measures JavaScript bundle sizes', async ({ page }) => {
      const bundleSizes: Record<string, number> = {}
      
      page.on('response', async response => {
        const url = response.url()
        if (url.includes('_next/static/chunks') && url.endsWith('.js')) {
          const size = Number(response.headers()['content-length'] || 0)
          const bundleName = url.split('/').pop() || 'unknown'
          bundleSizes[bundleName] = size
        }
      })
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      // Calculate totals
      const totalJSSize = Object.values(bundleSizes).reduce((sum, size) => sum + size, 0)
      const mainBundleSize = bundleSizes['main.js'] || 0
      const frameworkSize = bundleSizes['framework.js'] || 0
      
      console.log('Bundle Size Analysis:', {
        totalJS: `${(totalJSSize / 1024).toFixed(2)}KB`,
        mainBundle: `${(mainBundleSize / 1024).toFixed(2)}KB`,
        framework: `${(frameworkSize / 1024).toFixed(2)}KB`,
        bundleCount: Object.keys(bundleSizes).length
      })
      
      expect(totalJSSize).toBeLessThan(PERFORMANCE_BENCHMARKS.JS_BUNDLE.acceptable)
      
      // Detailed bundle report
      const sortedBundles = Object.entries(bundleSizes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
      
      console.log('Top 10 Largest Bundles:')
      sortedBundles.forEach(([name, size]) => {
        console.log(`  ${name}: ${(size / 1024).toFixed(2)}KB`)
      })
    })

    test('measures CSS bundle impact', async ({ page }) => {
      let cssSize = 0
      let cssCount = 0
      
      page.on('response', async response => {
        const url = response.url()
        if (url.includes('.css') || response.headers()['content-type']?.includes('text/css')) {
          cssSize += Number(response.headers()['content-length'] || 0)
          cssCount++
        }
      })
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      console.log('CSS Bundle Analysis:', {
        totalSize: `${(cssSize / 1024).toFixed(2)}KB`,
        fileCount: cssCount
      })
      
      expect(cssSize).toBeLessThan(PERFORMANCE_BENCHMARKS.CSS_BUNDLE.acceptable)
    })

    test('validates total page weight', async ({ page }) => {
      let totalSize = 0
      const resourceBreakdown: Record<string, number> = {
        javascript: 0,
        css: 0,
        images: 0,
        fonts: 0,
        other: 0
      }
      
      page.on('response', async response => {
        const size = Number(response.headers()['content-length'] || 0)
        const url = response.url()
        
        totalSize += size
        
        if (url.includes('.js')) resourceBreakdown.javascript += size
        else if (url.includes('.css')) resourceBreakdown.css += size
        else if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)/)) resourceBreakdown.images += size
        else if (url.match(/\.(woff|woff2|ttf|otf)/)) resourceBreakdown.fonts += size
        else resourceBreakdown.other += size
      })
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      console.log('Page Weight Analysis:', {
        total: `${(totalSize / 1024).toFixed(2)}KB`,
        breakdown: Object.entries(resourceBreakdown).map(([type, size]) => ({
          type,
          size: `${(size / 1024).toFixed(2)}KB`,
          percentage: `${((size / totalSize) * 100).toFixed(1)}%`
        }))
      })
      
      expect(totalSize).toBeLessThan(PERFORMANCE_BENCHMARKS.TOTAL_SIZE.acceptable)
    })
  })

  test.describe('Time to Interactive', () => {
    test('measures time to interactive for key pages', async ({ page }) => {
      const pages = [
        { url: '/', name: 'Homepage' },
        { url: '/stock/AAPL', name: 'Stock Detail' }
      ]
      
      for (const pageConfig of pages) {
        const startTime = Date.now()
        
        await page.goto(pageConfig.url)
        
        // Wait for page to be interactive
        await page.waitForLoadState('networkidle')
        await page.waitForFunction(() => {
          // Check if main interactive elements are ready
          const input = document.querySelector('input[placeholder*="ticker"]')
          const buttons = document.querySelectorAll('button')
          return input && buttons.length > 0
        })
        
        const tti = Date.now() - startTime
        
        console.log(`${pageConfig.name} TTI: ${tti}ms`)
        expect(tti).toBeLessThan(PERFORMANCE_BENCHMARKS.TTI.acceptable)
      }
    })

    test('measures interaction readiness', async ({ page }) => {
      await page.goto('/')
      
      const interactionMetrics = await page.evaluate(async () => {
        const metrics = {
          inputReady: 0,
          firstButtonReady: 0,
          allInteractiveReady: 0
        }
        
        const startTime = performance.now()
        
        // Wait for input to be ready
        await new Promise<void>(resolve => {
          const checkInput = () => {
            const input = document.querySelector('input[placeholder*="ticker"]') as HTMLInputElement
            if (input && !input.disabled) {
              metrics.inputReady = performance.now() - startTime
              resolve()
            } else {
              requestAnimationFrame(checkInput)
            }
          }
          checkInput()
        })
        
        // Check when first button is ready
        const firstButton = document.querySelector('button')
        if (firstButton) {
          metrics.firstButtonReady = performance.now() - startTime
        }
        
        // Check when all interactive elements are ready
        const checkAllReady = () => {
          const inputs = document.querySelectorAll('input:not([disabled])')
          const buttons = document.querySelectorAll('button:not([disabled])')
          const links = document.querySelectorAll('a[href]')
          
          if (inputs.length > 0 && buttons.length > 0 && links.length > 0) {
            metrics.allInteractiveReady = performance.now() - startTime
            return true
          }
          return false
        }
        
        if (!checkAllReady()) {
          await new Promise<void>(resolve => {
            const observer = new MutationObserver(() => {
              if (checkAllReady()) {
                observer.disconnect()
                resolve()
              }
            })
            observer.observe(document.body, { childList: true, subtree: true })
          })
        }
        
        return metrics
      })
      
      console.log('Interaction Readiness:', interactionMetrics)
      expect(interactionMetrics.inputReady).toBeLessThan(1000)
      expect(interactionMetrics.allInteractiveReady).toBeLessThan(3000)
    })
  })

  test.describe('Caching Effectiveness', () => {
    test('validates browser caching', async ({ page, context }) => {
      // First visit
      let cachedResources = 0
      let totalResources = 0
      
      page.on('response', response => {
        if (response.url().includes('_next/static')) {
          totalResources++
          const cacheControl = response.headers()['cache-control']
          if (cacheControl && cacheControl.includes('max-age')) {
            cachedResources++
          }
        }
      })
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      const cacheRate = (cachedResources / totalResources) * 100
      console.log(`Cache headers set for ${cacheRate.toFixed(1)}% of static resources`)
      expect(cacheRate).toBeGreaterThan(90)
      
      // Second visit (should use cache)
      let cachedHits = 0
      
      const page2 = await context.newPage()
      page2.on('response', response => {
        if (response.status() === 304 || response.fromCache()) {
          cachedHits++
        }
      })
      
      await page2.goto('/')
      await page2.waitForLoadState('networkidle')
      
      console.log(`Cache hits on second visit: ${cachedHits}`)
      expect(cachedHits).toBeGreaterThan(0)
    })

    test('measures Service Worker performance', async ({ page }) => {
      // Check if Service Worker is registered
      const swRegistered = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations()
          return registrations.length > 0
        }
        return false
      })
      
      console.log(`Service Worker registered: ${swRegistered}`)
      
      if (swRegistered) {
        // Measure SW response times
        const swMetrics = await page.evaluate(async () => {
          const timings: number[] = []
          
          // Make a few requests to test SW caching
          for (let i = 0; i < 5; i++) {
            const start = performance.now()
            await fetch('/favicon.ico')
            const end = performance.now()
            timings.push(end - start)
          }
          
          return {
            avgResponseTime: timings.reduce((a, b) => a + b, 0) / timings.length,
            minResponseTime: Math.min(...timings),
            maxResponseTime: Math.max(...timings)
          }
        })
        
        console.log('Service Worker Performance:', swMetrics)
        expect(swMetrics.avgResponseTime).toBeLessThan(50) // Should be fast from cache
      }
    })
  })

  test.describe('Performance Budget Validation', () => {
    test('validates performance budget compliance', async ({ page }) => {
      const budget = {
        metrics: {
          LCP: PERFORMANCE_BENCHMARKS.LCP.good,
          FID: PERFORMANCE_BENCHMARKS.FID.good,
          CLS: PERFORMANCE_BENCHMARKS.CLS.good,
          bundleSize: PERFORMANCE_BENCHMARKS.JS_BUNDLE.good
        },
        results: {} as Record<string, { value: number, passed: boolean }>
      }
      
      // Measure all metrics
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(3000)
      
      const webVitals = await performanceTester.measureWebVitals()
      
      // Check Web Vitals
      budget.results.LCP = {
        value: webVitals.lcp,
        passed: webVitals.lcp <= budget.metrics.LCP
      }
      
      budget.results.FID = {
        value: webVitals.fid,
        passed: webVitals.fid <= budget.metrics.FID
      }
      
      budget.results.CLS = {
        value: webVitals.cls,
        passed: webVitals.cls <= budget.metrics.CLS
      }
      
      // Check bundle size
      const jsSize = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script[src]'))
        return scripts.reduce((total, script) => {
          // Estimate size (in real scenario, would get from build stats)
          return total + 50000 // 50KB estimate per script
        }, 0)
      })
      
      budget.results.bundleSize = {
        value: jsSize,
        passed: jsSize <= budget.metrics.bundleSize
      }
      
      // Generate report
      const passedCount = Object.values(budget.results).filter(r => r.passed).length
      const totalCount = Object.keys(budget.results).length
      const passRate = (passedCount / totalCount) * 100
      
      console.log('Performance Budget Report:')
      console.log(`Overall Pass Rate: ${passRate.toFixed(1)}%`)
      console.log('Detailed Results:')
      Object.entries(budget.results).forEach(([metric, result]) => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        const target = budget.metrics[metric as keyof typeof budget.metrics]
        console.log(`  ${metric}: ${result.value} (target: ${target}) ${status}`)
      })
      
      expect(passRate).toBeGreaterThan(75) // At least 75% of metrics should pass
    })
  })
})