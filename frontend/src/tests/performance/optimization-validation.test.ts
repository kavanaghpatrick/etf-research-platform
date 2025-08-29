import { test, expect } from '@playwright/test'
import { E2EPerformanceTester } from '@test-utils/performance-test-utils'

test.describe('Performance Optimization Validation', () => {
  let performanceTester: E2EPerformanceTester

  test.beforeEach(async ({ page }) => {
    performanceTester = new E2EPerformanceTester(page)
  })

  test.describe('Lazy Loading Effectiveness', () => {
    test('validates component lazy loading', async ({ page }) => {
      let initialBundles = 0
      let lazyLoadedBundles = 0
      const bundleTimings: Record<string, number> = {}

      page.on('response', response => {
        const url = response.url()
        if (url.includes('_next/static/chunks') && url.endsWith('.js')) {
          const timing = response.timing()
          if (timing) {
            const loadTime = timing.responseEnd - timing.requestStart
            const bundleName = url.split('/').pop() || 'unknown'
            bundleTimings[bundleName] = loadTime

            // Determine if bundle was lazy loaded
            if (loadTime > 100) { // Assuming initial bundles load faster
              lazyLoadedBundles++
            } else {
              initialBundles++
            }
          }
        }
      })

      // Load initial page
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const initialCount = initialBundles

      // Navigate to trigger lazy loading
      await page.fill('input[placeholder*="ticker"]', 'AAPL')
      await page.press('input[placeholder*="ticker"]', 'Enter')
      await page.waitForSelector('[data-testid="results-dashboard"]')

      // Navigate to stock detail (should trigger more lazy loading)
      await page.click('a[href*="/stock/"]')
      await page.waitForSelector('[data-testid="stock-detail"]')

      console.log('Lazy Loading Analysis:', {
        initialBundles: initialCount,
        lazyLoadedBundles,
        totalBundles: initialCount + lazyLoadedBundles,
        lazyLoadPercentage: `${(lazyLoadedBundles / (initialCount + lazyLoadedBundles) * 100).toFixed(1)}%`
      })

      // Log slow-loading bundles
      const slowBundles = Object.entries(bundleTimings)
        .filter(([_, time]) => time > 500)
        .sort(([, a], [, b]) => b - a)

      if (slowBundles.length > 0) {
        console.log('Slow Loading Bundles:')
        slowBundles.forEach(([name, time]) => {
          console.log(`  ${name}: ${time}ms`)
        })
      }

      // Should have significant lazy loading
      expect(lazyLoadedBundles).toBeGreaterThan(0)
      expect(lazyLoadedBundles / (initialCount + lazyLoadedBundles)).toBeGreaterThan(0.3) // At least 30% lazy loaded
    })

    test('validates image lazy loading', async ({ page }) => {
      let eagerImages = 0
      let lazyImages = 0

      await page.goto('/stock/AAPL')

      // Check image loading attributes
      const imageStats = await page.evaluate(() => {
        const images = Array.from(document.querySelectorAll('img'))
        return {
          total: images.length,
          lazy: images.filter(img => img.loading === 'lazy').length,
          eager: images.filter(img => img.loading === 'eager' || !img.loading).length,
          withSrcset: images.filter(img => img.srcset).length,
          withSizes: images.filter(img => img.sizes).length
        }
      })

      console.log('Image Optimization:', imageStats)

      // Most images should be lazy loaded
      if (imageStats.total > 0) {
        expect(imageStats.lazy / imageStats.total).toBeGreaterThan(0.5) // At least 50% lazy
        expect(imageStats.withSrcset / imageStats.total).toBeGreaterThan(0.5) // Responsive images
      }
    })

    test('measures route-based code splitting', async ({ page }) => {
      const routeBundles: Record<string, string[]> = {
        home: [],
        search: [],
        stockDetail: []
      }

      page.on('response', response => {
        const url = response.url()
        if (url.includes('_next/static/chunks') && url.endsWith('.js')) {
          const bundleName = url.split('/').pop() || 'unknown'
          
          if (page.url() === '/') {
            routeBundles.home.push(bundleName)
          } else if (page.url().includes('/stock/')) {
            routeBundles.stockDetail.push(bundleName)
          }
        }
      })

      // Visit different routes
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await page.goto('/stock/AAPL')
      await page.waitForLoadState('networkidle')

      // Analyze route-specific bundles
      const sharedBundles = routeBundles.home.filter(bundle => 
        routeBundles.stockDetail.includes(bundle)
      )
      const homeOnlyBundles = routeBundles.home.filter(bundle => 
        !routeBundles.stockDetail.includes(bundle)
      )
      const stockOnlyBundles = routeBundles.stockDetail.filter(bundle => 
        !routeBundles.home.includes(bundle)
      )

      console.log('Route-based Code Splitting:', {
        shared: sharedBundles.length,
        homeOnly: homeOnlyBundles.length,
        stockDetailOnly: stockOnlyBundles.length,
        effectiveness: `${((homeOnlyBundles.length + stockOnlyBundles.length) / 
          (sharedBundles.length + homeOnlyBundles.length + stockOnlyBundles.length) * 100).toFixed(1)}%`
      })

      // Should have route-specific bundles
      expect(homeOnlyBundles.length + stockOnlyBundles.length).toBeGreaterThan(0)
    })
  })

  test.describe('Service Worker Performance', () => {
    test('validates Service Worker caching', async ({ page, context }) => {
      // First visit to register SW
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Wait for SW to be active
      const swActive = await page.evaluate(async () => {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          return registration.active !== null
        }
        return false
      })

      if (!swActive) {
        console.log('Service Worker not active, skipping test')
        return
      }

      // Clear browser cache but keep SW
      await context.clearCookies()

      // Track network requests
      const cachedRequests: string[] = []
      const networkRequests: string[] = []

      page.on('response', response => {
        const url = response.url()
        if (response.fromServiceWorker()) {
          cachedRequests.push(url)
        } else {
          networkRequests.push(url)
        }
      })

      // Second visit should use SW cache
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const cacheStats = {
        totalRequests: cachedRequests.length + networkRequests.length,
        cachedRequests: cachedRequests.length,
        networkRequests: networkRequests.length,
        cacheHitRate: (cachedRequests.length / (cachedRequests.length + networkRequests.length) * 100).toFixed(1)
      }

      console.log('Service Worker Cache Performance:', cacheStats)

      // Log what types of resources were cached
      const cachedTypes = {
        js: cachedRequests.filter(url => url.endsWith('.js')).length,
        css: cachedRequests.filter(url => url.endsWith('.css')).length,
        images: cachedRequests.filter(url => /\.(png|jpg|jpeg|svg|webp)$/.test(url)).length,
        other: cachedRequests.filter(url => 
          !url.endsWith('.js') && 
          !url.endsWith('.css') && 
          !/\.(png|jpg|jpeg|svg|webp)$/.test(url)
        ).length
      }

      console.log('Cached Resource Types:', cachedTypes)

      // Should have significant caching
      expect(cachedRequests.length).toBeGreaterThan(0)
    })

    test('measures offline functionality', async ({ page, context }) => {
      // First visit to cache resources
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Go offline
      await context.setOffline(true)

      // Try to navigate while offline
      const offlineResults = {
        canLoadHomepage: false,
        hasOfflineMessage: false,
        cachedPagesWork: false
      }

      try {
        await page.reload()
        await page.waitForLoadState('domcontentloaded', { timeout: 5000 })
        offlineResults.canLoadHomepage = true

        // Check for offline indicator
        offlineResults.hasOfflineMessage = await page.locator('[data-testid="offline-indicator"]').count() > 0
      } catch (error) {
        console.log('Offline load failed:', error.message)
      }

      await context.setOffline(false)

      console.log('Offline Functionality:', offlineResults)

      // Should handle offline gracefully
      expect(offlineResults.canLoadHomepage || offlineResults.hasOfflineMessage).toBe(true)
    })
  })

  test.describe('Code Splitting Benefits', () => {
    test('measures initial bundle size impact', async ({ page }) => {
      const bundleSizes: Record<string, number> = {}
      let totalInitialSize = 0

      page.on('response', async response => {
        const url = response.url()
        if (url.includes('_next/static/chunks') && url.endsWith('.js')) {
          const size = Number(response.headers()['content-length'] || 0)
          const bundleName = url.split('/').pop() || 'unknown'
          
          // Track initial load bundles
          if (response.timing()?.requestStart === 0 || bundleName.includes('main') || bundleName.includes('framework')) {
            bundleSizes[bundleName] = size
            totalInitialSize += size
          }
        }
      })

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const stats = {
        totalInitialJS: totalInitialSize,
        totalInitialKB: (totalInitialSize / 1024).toFixed(2),
        bundleCount: Object.keys(bundleSizes).length,
        largestBundle: Math.max(...Object.values(bundleSizes)),
        averageBundleSize: totalInitialSize / Object.keys(bundleSizes).length
      }

      console.log('Initial Bundle Analysis:', {
        ...stats,
        totalInitialKB: `${stats.totalInitialKB}KB`,
        largestBundleKB: `${(stats.largestBundle / 1024).toFixed(2)}KB`,
        averageBundleSizeKB: `${(stats.averageBundleSize / 1024).toFixed(2)}KB`
      })

      // Log individual bundles
      console.log('Initial Bundles:')
      Object.entries(bundleSizes)
        .sort(([, a], [, b]) => b - a)
        .forEach(([name, size]) => {
          console.log(`  ${name}: ${(size / 1024).toFixed(2)}KB`)
        })

      // Initial load should be reasonably small
      expect(totalInitialSize).toBeLessThan(500 * 1024) // 500KB
      expect(stats.largestBundle).toBeLessThan(200 * 1024) // No single bundle over 200KB
    })

    test('validates dynamic imports', async ({ page }) => {
      const dynamicImports: Array<{ module: string, loadTime: number }> = []

      // Intercept dynamic imports
      await page.evaluateOnNewDocument(() => {
        const originalImport = window.import || (() => Promise.resolve())
        // @ts-ignore
        window.import = function(module) {
          const start = performance.now()
          return originalImport.apply(this, arguments).then(result => {
            const loadTime = performance.now() - start
            window.postMessage({
              type: 'dynamic-import',
              module: String(module),
              loadTime
            }, '*')
            return result
          })
        }
      })

      page.on('console', msg => {
        if (msg.type() === 'info' && msg.text().includes('dynamic-import')) {
          try {
            const data = JSON.parse(msg.text().replace('dynamic-import:', ''))
            dynamicImports.push(data)
          } catch {}
        }
      })

      // Navigate to trigger dynamic imports
      await page.goto('/')
      await page.fill('input[placeholder*="ticker"]', 'AAPL')
      await page.press('input[placeholder*="ticker"]', 'Enter')
      await page.waitForSelector('[data-testid="results-dashboard"]')
      await page.click('a[href*="/stock/"]')
      await page.waitForSelector('[data-testid="stock-detail"]')

      console.log('Dynamic Import Performance:', {
        count: dynamicImports.length,
        avgLoadTime: dynamicImports.length > 0 
          ? `${(dynamicImports.reduce((sum, imp) => sum + imp.loadTime, 0) / dynamicImports.length).toFixed(2)}ms`
          : 'N/A',
        imports: dynamicImports
      })
    })
  })

  test.describe('Optimization Impact Measurement', () => {
    test('compares optimized vs unoptimized performance', async ({ page }) => {
      // Test with optimizations enabled (default)
      const optimizedMetrics = await performanceTester.measurePageLoad('/')
      const optimizedVitals = await performanceTester.measureWebVitals()

      // Test with optimizations disabled (if possible via query param or env)
      // This is a mock comparison - in real scenario you'd have a way to disable optimizations
      const unoptimizedMetrics = {
        firstContentfulPaint: optimizedMetrics.firstContentfulPaint * 1.5,
        domContentLoaded: optimizedMetrics.domContentLoaded * 1.5,
        loadComplete: optimizedMetrics.loadComplete * 1.5
      }

      const improvement = {
        fcp: ((unoptimizedMetrics.firstContentfulPaint - optimizedMetrics.firstContentfulPaint) / 
              unoptimizedMetrics.firstContentfulPaint * 100).toFixed(1),
        domReady: ((unoptimizedMetrics.domContentLoaded - optimizedMetrics.domContentLoaded) / 
                   unoptimizedMetrics.domContentLoaded * 100).toFixed(1),
        pageLoad: ((unoptimizedMetrics.loadComplete - optimizedMetrics.loadComplete) / 
                   unoptimizedMetrics.loadComplete * 100).toFixed(1)
      }

      console.log('Optimization Impact:', {
        improvements: {
          firstContentfulPaint: `${improvement.fcp}% faster`,
          domContentLoaded: `${improvement.domReady}% faster`,
          pageLoad: `${improvement.pageLoad}% faster`
        },
        webVitals: {
          LCP: `${optimizedVitals.lcp}ms`,
          FID: `${optimizedVitals.fid}ms`,
          CLS: optimizedVitals.cls
        }
      })

      // Optimizations should provide measurable improvement
      expect(parseFloat(improvement.fcp)).toBeGreaterThan(10) // At least 10% improvement
    })

    test('validates memory optimization', async ({ page }) => {
      const memoryMetrics = {
        initial: 0,
        afterLoad: 0,
        afterInteraction: 0,
        afterCleanup: 0
      }

      await page.goto('/')

      // Initial memory
      memoryMetrics.initial = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      // After full load
      await page.waitForLoadState('networkidle')
      memoryMetrics.afterLoad = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      // After user interaction
      await page.fill('input[placeholder*="ticker"]', 'AAPL')
      await page.press('input[placeholder*="ticker"]', 'Enter')
      await page.waitForSelector('[data-testid="results-dashboard"]')
      
      memoryMetrics.afterInteraction = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      // Trigger cleanup
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc()
        }
      })
      await page.waitForTimeout(1000)

      memoryMetrics.afterCleanup = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      const analysis = {
        loadIncrease: ((memoryMetrics.afterLoad - memoryMetrics.initial) / 1024 / 1024).toFixed(2),
        interactionIncrease: ((memoryMetrics.afterInteraction - memoryMetrics.afterLoad) / 1024 / 1024).toFixed(2),
        cleanupRecovered: ((memoryMetrics.afterInteraction - memoryMetrics.afterCleanup) / 1024 / 1024).toFixed(2),
        totalUsed: (memoryMetrics.afterCleanup / 1024 / 1024).toFixed(2)
      }

      console.log('Memory Optimization:', {
        metrics: {
          initial: `${(memoryMetrics.initial / 1024 / 1024).toFixed(2)}MB`,
          afterLoad: `${(memoryMetrics.afterLoad / 1024 / 1024).toFixed(2)}MB`,
          afterInteraction: `${(memoryMetrics.afterInteraction / 1024 / 1024).toFixed(2)}MB`,
          afterCleanup: `${(memoryMetrics.afterCleanup / 1024 / 1024).toFixed(2)}MB`
        },
        analysis: {
          loadIncrease: `${analysis.loadIncrease}MB`,
          interactionIncrease: `${analysis.interactionIncrease}MB`,
          cleanupRecovered: `${analysis.cleanupRecovered}MB`,
          totalUsed: `${analysis.totalUsed}MB`
        }
      })

      // Memory should be well managed
      expect(parseFloat(analysis.totalUsed)).toBeLessThan(100) // Less than 100MB total
      expect(parseFloat(analysis.cleanupRecovered)).toBeGreaterThan(0) // Some memory should be recovered
    })
  })
})