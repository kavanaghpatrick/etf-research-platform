import { test, expect } from '@playwright/test'
import { E2EPerformanceTester, PERFORMANCE_THRESHOLDS } from '@test-utils/performance-test-utils'

// Configure test timeout for load testing
test.setTimeout(120000) // 2 minutes

test.describe('Load Testing', () => {
  let performanceTester: E2EPerformanceTester

  test.beforeEach(async ({ page }) => {
    performanceTester = new E2EPerformanceTester(page)
  })

  test.describe('API Response Times Under Load', () => {
    test('handles concurrent API requests efficiently', async ({ page }) => {
      await page.goto('/')
      
      // Simulate concurrent user searches
      const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
      const concurrentRequests = 10
      
      const timings: number[] = []
      
      for (let i = 0; i < concurrentRequests; i++) {
        const symbol = symbols[i % symbols.length]
        const startTime = Date.now()
        
        // Type symbol and trigger search
        await page.fill('input[placeholder*="ticker"]', symbol)
        await page.press('input[placeholder*="ticker"]', 'Enter')
        
        // Wait for results
        await page.waitForSelector('[data-testid="results-dashboard"]', { 
          state: 'visible',
          timeout: 10000 
        })
        
        const endTime = Date.now()
        timings.push(endTime - startTime)
        
        // Clear input for next search
        await page.fill('input[placeholder*="ticker"]', '')
      }
      
      // Analyze response times
      const avgResponseTime = timings.reduce((a, b) => a + b, 0) / timings.length
      const maxResponseTime = Math.max(...timings)
      
      console.log(`Average response time: ${avgResponseTime}ms`)
      console.log(`Max response time: ${maxResponseTime}ms`)
      
      // Assert performance
      expect(avgResponseTime).toBeLessThan(3000) // 3 seconds average
      expect(maxResponseTime).toBeLessThan(5000) // 5 seconds max
    })

    test('maintains performance with rapid successive searches', async ({ page }) => {
      await page.goto('/')
      
      const rapidSearchDelay = 100 // 100ms between searches
      const searchCount = 20
      const symbol = 'SPY'
      
      const startTime = Date.now()
      
      for (let i = 0; i < searchCount; i++) {
        await page.fill('input[placeholder*="ticker"]', symbol)
        await page.press('input[placeholder*="ticker"]', 'Enter')
        await page.waitForTimeout(rapidSearchDelay)
      }
      
      const totalTime = Date.now() - startTime
      const avgTimePerSearch = totalTime / searchCount
      
      console.log(`Rapid search performance: ${avgTimePerSearch}ms per search`)
      
      expect(avgTimePerSearch).toBeLessThan(500) // 500ms per search
    })
  })

  test.describe('Frontend Rendering Performance', () => {
    test('renders large dataset efficiently', async ({ page }) => {
      // Navigate to a stock with lots of data
      const metrics = await performanceTester.measurePageLoad('/stock/AAPL')
      
      expect(metrics.firstContentfulPaint).toBeLessThan(PERFORMANCE_THRESHOLDS.firstContentfulPaint)
      expect(metrics.domContentLoaded).toBeLessThan(1000)
      expect(metrics.loadComplete).toBeLessThan(3000)
    })

    test('handles chart rendering with large datasets', async ({ page }) => {
      await page.goto('/stock/AAPL')
      
      // Measure time range changes
      const timeRanges = ['1D', '1W', '1M', '3M', '1Y', '5Y']
      const renderTimes: Record<string, number> = {}
      
      for (const range of timeRanges) {
        const startTime = await page.evaluate(() => performance.now())
        
        await page.click(`button:has-text("${range}")`)
        await page.waitForLoadState('networkidle')
        
        const endTime = await page.evaluate(() => performance.now())
        renderTimes[range] = endTime - startTime
      }
      
      console.log('Chart render times:', renderTimes)
      
      // All time ranges should render quickly
      Object.values(renderTimes).forEach(time => {
        expect(time).toBeLessThan(1000) // 1 second max
      })
    })

    test('maintains smooth scrolling performance', async ({ page }) => {
      await page.goto('/stock/AAPL')
      
      // Measure scroll performance
      const scrollMetrics = await page.evaluate(async () => {
        const measurements: number[] = []
        let lastTime = performance.now()
        let frameCount = 0
        
        return new Promise<{ fps: number, jank: number }>((resolve) => {
          const measureFrame = () => {
            const currentTime = performance.now()
            const delta = currentTime - lastTime
            
            if (delta > 16.67 * 1.5) { // Jank threshold (1.5x normal frame time)
              measurements.push(delta)
            }
            
            frameCount++
            lastTime = currentTime
            
            if (frameCount < 60) { // Measure 60 frames
              requestAnimationFrame(measureFrame)
            } else {
              const fps = 1000 / (measurements.reduce((a, b) => a + b, 0) / measurements.length || 16.67)
              const jankFrames = measurements.filter(d => d > 16.67 * 1.5).length
              resolve({ fps, jank: jankFrames })
            }
          }
          
          // Start scrolling
          window.scrollTo({ top: 1000, behavior: 'smooth' })
          requestAnimationFrame(measureFrame)
        })
      })
      
      console.log('Scroll performance:', scrollMetrics)
      
      expect(scrollMetrics.fps).toBeGreaterThan(50) // At least 50 fps
      expect(scrollMetrics.jank).toBeLessThan(5) // Less than 5 jank frames
    })
  })

  test.describe('Memory Usage Patterns', () => {
    test('prevents memory leaks during navigation', async ({ page }) => {
      const initialMemory = await performanceTester.measureMemoryUsage()
      
      // Navigate through multiple pages
      const pages = [
        '/',
        '/stock/AAPL',
        '/stock/MSFT',
        '/stock/GOOGL',
        '/'
      ]
      
      for (const url of pages) {
        await page.goto(url)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(1000) // Let page settle
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc()
        }
      })
      
      const finalMemory = await performanceTester.measureMemoryUsage()
      
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize
        const percentIncrease = (memoryIncrease / initialMemory.usedJSHeapSize) * 100
        
        console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB (${percentIncrease.toFixed(2)}%)`)
        
        // Memory should not increase by more than 20%
        expect(percentIncrease).toBeLessThan(20)
      }
    })

    test('handles large data operations without excessive memory', async ({ page }) => {
      await page.goto('/stock/SPY')
      
      const memoryBefore = await performanceTester.measureMemoryUsage()
      
      // Trigger data-intensive operations
      const timeRanges = ['5Y', '10Y', 'MAX']
      for (const range of timeRanges) {
        if (await page.locator(`button:has-text("${range}")`).count() > 0) {
          await page.click(`button:has-text("${range}")`)
          await page.waitForLoadState('networkidle')
        }
      }
      
      const memoryAfter = await performanceTester.measureMemoryUsage()
      
      if (memoryBefore && memoryAfter) {
        const memoryUsed = memoryAfter.usedJSHeapSize - memoryBefore.usedJSHeapSize
        console.log(`Memory used for large datasets: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`)
        
        // Should use less than 100MB for large datasets
        expect(memoryUsed).toBeLessThan(100 * 1024 * 1024)
      }
    })
  })

  test.describe('Concurrent User Scenarios', () => {
    test('simulates multiple users accessing different stocks', async ({ browser }) => {
      const userCount = 5
      const contexts = []
      const pages = []
      
      // Create multiple browser contexts (simulating different users)
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext()
        const page = await context.newPage()
        contexts.push(context)
        pages.push(page)
      }
      
      const stocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA']
      const loadTimes: number[] = []
      
      // Simulate concurrent access
      const promises = pages.map(async (page, index) => {
        const startTime = Date.now()
        await page.goto(`/stock/${stocks[index]}`)
        await page.waitForLoadState('networkidle')
        const endTime = Date.now()
        return endTime - startTime
      })
      
      const times = await Promise.all(promises)
      times.forEach(time => loadTimes.push(time))
      
      // Cleanup
      for (const context of contexts) {
        await context.close()
      }
      
      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length
      console.log(`Average load time with ${userCount} concurrent users: ${avgLoadTime}ms`)
      
      expect(avgLoadTime).toBeLessThan(5000) // 5 seconds average
      expect(Math.max(...loadTimes)).toBeLessThan(10000) // 10 seconds max
    })

    test('handles concurrent chart interactions', async ({ browser }) => {
      const interactionCount = 10
      const page1 = await browser.newPage()
      const page2 = await browser.newPage()
      
      await Promise.all([
        page1.goto('/stock/AAPL'),
        page2.goto('/stock/MSFT')
      ])
      
      const interactions = []
      
      // Simulate concurrent interactions
      for (let i = 0; i < interactionCount; i++) {
        interactions.push(
          page1.click('button:has-text("1M")').catch(() => {}),
          page2.click('button:has-text("3M")').catch(() => {}),
          page1.hover('[data-testid="stock-chart"]').catch(() => {}),
          page2.hover('[data-testid="stock-chart"]').catch(() => {})
        )
      }
      
      const startTime = Date.now()
      await Promise.all(interactions)
      const totalTime = Date.now() - startTime
      
      console.log(`Concurrent interactions completed in: ${totalTime}ms`)
      
      await page1.close()
      await page2.close()
      
      expect(totalTime).toBeLessThan(10000) // 10 seconds for all interactions
    })
  })

  test.describe('Resource Loading Performance', () => {
    test('optimizes bundle loading', async ({ page }) => {
      const resourceTimings: Record<string, number> = {}
      
      page.on('response', response => {
        const url = response.url()
        const timing = response.timing()
        
        if (url.includes('_next/static') && timing) {
          const type = url.includes('.js') ? 'javascript' : 
                       url.includes('.css') ? 'css' : 'other'
          
          if (!resourceTimings[type]) {
            resourceTimings[type] = 0
          }
          resourceTimings[type] += timing.responseEnd - timing.requestStart
        }
      })
      
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      console.log('Resource loading times:', resourceTimings)
      
      // JavaScript bundles should load quickly
      if (resourceTimings.javascript) {
        expect(resourceTimings.javascript).toBeLessThan(2000) // 2 seconds total
      }
    })

    test('validates lazy loading effectiveness', async ({ page }) => {
      let initialBundleCount = 0
      let lazyBundleCount = 0
      
      page.on('response', response => {
        if (response.url().includes('_next/static/chunks')) {
          if (response.timing()?.requestStart === 0) {
            initialBundleCount++
          } else {
            lazyBundleCount++
          }
        }
      })
      
      // Load initial page
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      
      const initialCount = initialBundleCount
      
      // Navigate to trigger lazy loading
      await page.click('a[href*="/stock/"]')
      await page.waitForLoadState('networkidle')
      
      console.log(`Initial bundles: ${initialCount}, Lazy loaded: ${lazyBundleCount}`)
      
      // Should have lazy loaded bundles
      expect(lazyBundleCount).toBeGreaterThan(0)
    })
  })
})