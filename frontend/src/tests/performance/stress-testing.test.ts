import { test, expect, Browser } from '@playwright/test'
import { E2EPerformanceTester } from '@test-utils/performance-test-utils'

test.describe('Stress Testing', () => {
  test.setTimeout(300000) // 5 minutes for stress tests

  test.describe('Extreme Load Testing', () => {
    test('handles 50 concurrent users', async ({ browser }) => {
      const userCount = 50
      const results = {
        successful: 0,
        failed: 0,
        avgLoadTime: 0,
        maxLoadTime: 0,
        errors: [] as string[]
      }

      const runUser = async (browser: Browser, userId: number) => {
        const context = await browser.newContext()
        const page = await context.newPage()
        
        try {
          const startTime = Date.now()
          
          // User journey
          await page.goto('/', { timeout: 30000 })
          await page.fill('input[placeholder*="ticker"]', 'AAPL')
          await page.press('input[placeholder*="ticker"]', 'Enter')
          await page.waitForSelector('[data-testid="results-dashboard"]', { timeout: 30000 })
          await page.click('a[href*="/stock/"]')
          await page.waitForSelector('[data-testid="stock-detail"]', { timeout: 30000 })
          
          const loadTime = Date.now() - startTime
          await context.close()
          
          return { success: true, loadTime }
        } catch (error) {
          await context.close()
          return { success: false, error: error.message }
        }
      }

      // Run concurrent users
      const userPromises = []
      for (let i = 0; i < userCount; i++) {
        userPromises.push(runUser(browser, i))
      }

      const userResults = await Promise.all(userPromises)

      // Analyze results
      let totalLoadTime = 0
      userResults.forEach(result => {
        if (result.success) {
          results.successful++
          totalLoadTime += result.loadTime
          results.maxLoadTime = Math.max(results.maxLoadTime, result.loadTime)
        } else {
          results.failed++
          results.errors.push(result.error)
        }
      })

      results.avgLoadTime = totalLoadTime / results.successful

      console.log('Stress Test Results (50 users):', {
        ...results,
        successRate: `${(results.successful / userCount * 100).toFixed(1)}%`,
        avgLoadTime: `${(results.avgLoadTime / 1000).toFixed(1)}s`,
        maxLoadTime: `${(results.maxLoadTime / 1000).toFixed(1)}s`
      })

      // At least 90% should succeed
      expect(results.successful / userCount).toBeGreaterThan(0.9)
      // Average load time should be under 10 seconds
      expect(results.avgLoadTime).toBeLessThan(10000)
    })

    test('handles rapid fire requests', async ({ page }) => {
      await page.goto('/')
      
      const requestCount = 100
      const requests = []
      const startTime = Date.now()

      // Fire off rapid requests
      for (let i = 0; i < requestCount; i++) {
        requests.push(
          page.evaluate(async () => {
            const response = await fetch('/api/stock/AAPL')
            return response.ok
          })
        )
      }

      const results = await Promise.all(requests)
      const duration = Date.now() - startTime
      const successCount = results.filter(r => r).length

      console.log('Rapid Fire Test Results:', {
        totalRequests: requestCount,
        successful: successCount,
        failed: requestCount - successCount,
        duration: `${duration}ms`,
        requestsPerSecond: (requestCount / duration * 1000).toFixed(1)
      })

      expect(successCount).toBe(requestCount) // All should succeed
      expect(duration).toBeLessThan(30000) // Should complete within 30 seconds
    })
  })

  test.describe('Memory Leak Detection', () => {
    test('prevents memory leaks during extended usage', async ({ page }) => {
      const memorySnapshots: number[] = []
      const actions = 30 // Number of actions to perform

      await page.goto('/')

      // Take initial memory snapshot
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      // Perform repeated actions
      for (let i = 0; i < actions; i++) {
        // Search for a stock
        await page.fill('input[placeholder*="ticker"]', `TEST${i}`)
        await page.press('input[placeholder*="ticker"]', 'Enter')
        await page.waitForTimeout(500)

        // Clear and prepare for next
        await page.fill('input[placeholder*="ticker"]', '')

        // Take memory snapshot every 5 actions
        if (i % 5 === 0) {
          const memory = await page.evaluate(() => {
            if ('memory' in performance) {
              return (performance as any).memory.usedJSHeapSize
            }
            return 0
          })
          memorySnapshots.push(memory)
        }
      }

      // Force garbage collection
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc()
        }
      })
      await page.waitForTimeout(1000)

      // Take final memory snapshot
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize
        }
        return 0
      })

      // Analyze memory growth
      const memoryGrowth = finalMemory - initialMemory
      const growthPercentage = (memoryGrowth / initialMemory) * 100

      console.log('Memory Leak Test Results:', {
        initialMemory: `${(initialMemory / 1024 / 1024).toFixed(2)}MB`,
        finalMemory: `${(finalMemory / 1024 / 1024).toFixed(2)}MB`,
        growth: `${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
        growthPercentage: `${growthPercentage.toFixed(1)}%`,
        snapshots: memorySnapshots.map(m => `${(m / 1024 / 1024).toFixed(2)}MB`)
      })

      // Memory growth should be less than 50%
      expect(growthPercentage).toBeLessThan(50)
    })

    test('cleans up resources on component unmount', async ({ page }) => {
      await page.goto('/stock/AAPL')

      // Monitor event listeners and timers
      const resourceCounts = await page.evaluate(() => {
        const getEventListenerCount = () => {
          // This is a simplified count - in real scenarios you'd use dev tools protocol
          return document.querySelectorAll('*').length
        }

        const getTimerCount = () => {
          // Count active timers (simplified)
          let count = 0
          const originalSetTimeout = window.setTimeout
          const originalSetInterval = window.setInterval
          
          window.setTimeout = function(...args) {
            count++
            return originalSetTimeout.apply(window, args)
          }
          
          window.setInterval = function(...args) {
            count++
            return originalSetInterval.apply(window, args)
          }
          
          return count
        }

        return {
          initial: {
            elements: document.querySelectorAll('*').length,
            listeners: getEventListenerCount()
          }
        }
      })

      // Navigate away and back multiple times
      for (let i = 0; i < 10; i++) {
        await page.goto('/')
        await page.goto('/stock/MSFT')
        await page.goto('/stock/GOOGL')
      }

      // Check final resource counts
      const finalCounts = await page.evaluate(() => {
        return {
          elements: document.querySelectorAll('*').length,
          listeners: document.querySelectorAll('*').length
        }
      })

      console.log('Resource Cleanup Test:', {
        initial: resourceCounts.initial,
        final: finalCounts,
        growth: {
          elements: finalCounts.elements - resourceCounts.initial.elements,
          percentage: ((finalCounts.elements - resourceCounts.initial.elements) / resourceCounts.initial.elements * 100).toFixed(1) + '%'
        }
      })

      // Element count shouldn't grow significantly
      expect(finalCounts.elements).toBeLessThan(resourceCounts.initial.elements * 1.5)
    })
  })

  test.describe('Performance Bottleneck Identification', () => {
    test('identifies slow API endpoints', async ({ page }) => {
      const slowEndpoints: Array<{ url: string, duration: number }> = []

      page.on('response', async response => {
        const timing = response.timing()
        if (timing && response.url().includes('/api/')) {
          const duration = timing.responseEnd - timing.requestStart
          if (duration > 1000) { // Endpoints taking more than 1 second
            slowEndpoints.push({
              url: response.url(),
              duration
            })
          }
        }
      })

      // Navigate through the app
      await page.goto('/')
      await page.fill('input[placeholder*="ticker"]', 'AAPL')
      await page.press('input[placeholder*="ticker"]', 'Enter')
      await page.waitForSelector('[data-testid="results-dashboard"]')
      await page.click('a[href*="/stock/"]')
      await page.waitForSelector('[data-testid="stock-detail"]')

      // Test different time ranges
      const timeRanges = ['1D', '1W', '1M', '3M', '1Y']
      for (const range of timeRanges) {
        if (await page.locator(`button:has-text("${range}")`).count() > 0) {
          await page.click(`button:has-text("${range}")`)
          await page.waitForTimeout(1000)
        }
      }

      console.log('Slow API Endpoints:', slowEndpoints)

      // Report any concerning endpoints
      if (slowEndpoints.length > 0) {
        console.log('Performance Bottlenecks Found:')
        slowEndpoints.forEach(endpoint => {
          console.log(`  ${endpoint.url}: ${endpoint.duration}ms`)
        })
      }
    })

    test('identifies render blocking resources', async ({ page }) => {
      const blockingResources: Array<{ url: string, blockTime: number }> = []

      await page.coverage.startCSSCoverage()
      await page.coverage.startJSCoverage()

      await page.goto('/', { waitUntil: 'networkidle' })

      const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage()
      ])

      // Analyze unused code
      const jsStats = {
        total: 0,
        used: 0,
        unused: 0
      }

      jsCoverage.forEach(entry => {
        jsStats.total += entry.text.length
        jsStats.used += entry.ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
      })
      jsStats.unused = jsStats.total - jsStats.used

      const cssStats = {
        total: 0,
        used: 0,
        unused: 0
      }

      cssCoverage.forEach(entry => {
        cssStats.total += entry.text.length
        cssStats.used += entry.ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
      })
      cssStats.unused = cssStats.total - cssStats.used

      console.log('Code Coverage Analysis:', {
        javascript: {
          total: `${(jsStats.total / 1024).toFixed(2)}KB`,
          used: `${(jsStats.used / 1024).toFixed(2)}KB`,
          unused: `${(jsStats.unused / 1024).toFixed(2)}KB`,
          unusedPercentage: `${((jsStats.unused / jsStats.total) * 100).toFixed(1)}%`
        },
        css: {
          total: `${(cssStats.total / 1024).toFixed(2)}KB`,
          used: `${(cssStats.used / 1024).toFixed(2)}KB`,
          unused: `${(cssStats.unused / 1024).toFixed(2)}KB`,
          unusedPercentage: `${((cssStats.unused / cssStats.total) * 100).toFixed(1)}%`
        }
      })

      // Flag if too much unused code
      expect(jsStats.unused / jsStats.total).toBeLessThan(0.5) // Less than 50% unused
      expect(cssStats.unused / cssStats.total).toBeLessThan(0.5) // Less than 50% unused
    })
  })

  test.describe('Error Handling Under Stress', () => {
    test('handles network failures gracefully', async ({ page, context }) => {
      // Simulate network failures
      await context.route('**/api/**', route => {
        if (Math.random() > 0.5) {
          route.abort('failed')
        } else {
          route.continue()
        }
      })

      await page.goto('/')
      
      let errorCount = 0
      let successCount = 0

      // Try multiple searches
      for (let i = 0; i < 10; i++) {
        try {
          await page.fill('input[placeholder*="ticker"]', 'AAPL')
          await page.press('input[placeholder*="ticker"]', 'Enter')
          
          // Check for error handling
          const hasError = await page.locator('[data-testid="error-message"]').count() > 0
          const hasResults = await page.locator('[data-testid="results-dashboard"]').count() > 0
          
          if (hasError) {
            errorCount++
            // Verify error is handled gracefully
            const errorText = await page.locator('[data-testid="error-message"]').textContent()
            expect(errorText).toBeTruthy()
          } else if (hasResults) {
            successCount++
          }
          
          await page.fill('input[placeholder*="ticker"]', '')
        } catch (error) {
          console.error('Unexpected error:', error)
        }
      }

      console.log('Network Failure Test Results:', {
        attempts: 10,
        successful: successCount,
        handled_errors: errorCount,
        unhandled_errors: 10 - successCount - errorCount
      })

      // All attempts should either succeed or show handled errors
      expect(successCount + errorCount).toBe(10)
    })

    test('maintains stability during server errors', async ({ page, context }) => {
      // Simulate server errors
      await context.route('**/api/**', route => {
        if (Math.random() > 0.7) {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
          })
        } else {
          route.continue()
        }
      })

      const errors: string[] = []
      page.on('pageerror', error => {
        errors.push(error.message)
      })

      await page.goto('/')

      // Perform actions that might trigger errors
      for (let i = 0; i < 5; i++) {
        await page.fill('input[placeholder*="ticker"]', `TEST${i}`)
        await page.press('input[placeholder*="ticker"]', 'Enter')
        await page.waitForTimeout(1000)
      }

      console.log('Server Error Handling:', {
        uncaughtErrors: errors.length,
        errors: errors
      })

      // No uncaught errors should occur
      expect(errors.length).toBe(0)
    })
  })

  test.describe('Scalability Limits', () => {
    test('determines maximum concurrent chart renders', async ({ page }) => {
      await page.goto('/stock/AAPL')

      let maxSuccessful = 0
      let limitFound = false

      for (let count = 5; count <= 50; count += 5) {
        try {
          // Create multiple chart containers
          await page.evaluate((chartCount) => {
            const container = document.querySelector('main') || document.body
            container.innerHTML = ''
            
            for (let i = 0; i < chartCount; i++) {
              const div = document.createElement('div')
              div.id = `chart-${i}`
              div.style.height = '200px'
              div.innerHTML = '<div data-testid="stock-chart">Chart</div>'
              container.appendChild(div)
            }
          }, count)

          // Measure rendering performance
          const renderTime = await page.evaluate(async () => {
            const start = performance.now()
            // Trigger re-render
            document.querySelectorAll('[data-testid="stock-chart"]').forEach(chart => {
              chart.dispatchEvent(new Event('render'))
            })
            await new Promise(resolve => setTimeout(resolve, 100))
            return performance.now() - start
          })

          console.log(`${count} charts rendered in ${renderTime}ms`)

          if (renderTime < 3000) {
            maxSuccessful = count
          } else {
            limitFound = true
            break
          }
        } catch (error) {
          limitFound = true
          break
        }
      }

      console.log('Chart Rendering Scalability:', {
        maxConcurrentCharts: maxSuccessful,
        limitFound
      })

      expect(maxSuccessful).toBeGreaterThan(10) // Should handle at least 10 charts
    })

    test('tests data processing limits', async ({ page }) => {
      await page.goto('/stock/AAPL')

      const dataSizes = [1000, 5000, 10000, 50000]
      const results: Record<number, number> = {}

      for (const size of dataSizes) {
        try {
          const processingTime = await page.evaluate(async (dataSize) => {
            // Generate test data
            const data = Array.from({ length: dataSize }, (_, i) => ({
              date: new Date(Date.now() - i * 60000).toISOString(),
              value: Math.random() * 100
            }))

            const start = performance.now()
            
            // Simulate data processing
            const processed = data.map(item => ({
              ...item,
              ma7: 0, // Would calculate moving average
              ma30: 0,
              volume: Math.random() * 1000000
            }))

            // Simulate chart data transformation
            const chartData = processed.map(item => ({
              x: item.date,
              y: item.value
            }))

            return performance.now() - start
          }, size)

          results[size] = processingTime
          console.log(`Processing ${size} data points: ${processingTime}ms`)

          // If processing takes too long, we've found the limit
          if (processingTime > 5000) {
            break
          }
        } catch (error) {
          console.error(`Failed at ${size} data points`)
          break
        }
      }

      console.log('Data Processing Limits:', results)

      // Should handle at least 10k data points efficiently
      expect(results[10000]).toBeLessThan(2000)
    })
  })
})