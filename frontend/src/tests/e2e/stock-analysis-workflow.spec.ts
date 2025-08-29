import { test, expect, Page } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

// Helper to wait for chart to load
async function waitForChartLoad(page: Page) {
  await page.waitForSelector('[data-testid="stock-chart"]', { state: 'visible' })
  await page.waitForLoadState('networkidle')
  // Wait for any animations to complete
  await page.waitForTimeout(500)
}

// Helper to verify data table content
async function verifyDataTable(page: Page) {
  const table = page.locator('table').first()
  await expect(table).toBeVisible()
  
  // Verify headers
  const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume']
  for (const header of headers) {
    await expect(table.locator('th', { hasText: header })).toBeVisible()
  }
  
  // Verify at least some data rows exist
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(10) // Recent data shows 10 rows
}

test.describe('Stock Analysis Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up request interception for consistent testing
    await page.route('**/data/fetch', async route => {
      const mockData = {
        data: {
          AAPL: {
            data: Array.from({ length: 100 }, (_, i) => ({
              Date: new Date(Date.now() - i * 86400000).toISOString(),
              Open: 150 + Math.random() * 10,
              High: 155 + Math.random() * 10,
              Low: 145 + Math.random() * 10,
              Close: 150 + Math.random() * 10,
              Volume: 50000000 + Math.random() * 10000000,
            })),
            date_range: {
              start: new Date(Date.now() - 100 * 86400000).toISOString(),
              end: new Date().toISOString(),
            },
          },
        },
        metadata: {
          successful_tickers: 1,
          total_tickers: 1,
          execution_time: 0.523,
        },
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      })
    })
  })

  test('complete user journey from search to analysis', async ({ page }) => {
    // Step 1: Navigate to homepage
    await page.goto('/')
    await expect(page).toHaveTitle(/ETF Research Platform/)
    
    // Step 2: Search for a stock
    const searchInput = page.locator('[data-testid="ticker-search"]')
    await searchInput.fill('AAPL')
    await searchInput.press('Enter')
    
    // Step 3: Wait for navigation to stock detail page
    await page.waitForURL(/\/stock\/AAPL/)
    await expect(page.locator('h1', { hasText: 'AAPL' })).toBeVisible()
    
    // Step 4: Verify initial data load
    await waitForChartLoad(page)
    await expect(page.locator('text=AAPL Price Chart')).toBeVisible()
    await expect(page.locator('text=100 data points available')).toBeVisible()
    
    // Step 5: Interact with time range selector
    await page.click('button:has-text("3M")')
    await waitForChartLoad(page)
    
    // Verify URL updated
    await expect(page).toHaveURL(/range=3M/)
    
    // Step 6: Use custom date range
    await page.click('button:has-text("Custom")')
    await expect(page.locator('text=Custom Date Range')).toBeVisible()
    
    const startDate = page.locator('input[type="date"]').first()
    const endDate = page.locator('input[type="date"]').last()
    
    // Set dates 6 months apart
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    await startDate.fill(sixMonthsAgo.toISOString().split('T')[0])
    await endDate.fill(new Date().toISOString().split('T')[0])
    
    await page.click('button:has-text("Apply")')
    await waitForChartLoad(page)
    
    // Step 7: Verify data summary
    await expect(page.locator('text=Data Summary')).toBeVisible()
    const dataPoints = page.locator('text=Data Points').locator('..')
    await expect(dataPoints).toContainText(/\d+/)
    
    // Step 8: Check recent data table
    await expect(page.locator('text=Recent Data')).toBeVisible()
    await verifyDataTable(page)
    
    // Step 9: Test share functionality
    await page.click('button:has-text("Share")')
    
    // Verify clipboard write or fallback prompt
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText()).catch(() => null)
    if (clipboardText) {
      expect(clipboardText).toContain('/stock/AAPL')
    }
    
    // Step 10: Navigate back to portfolio
    await page.click('a:has-text("Back to Portfolio")')
    await page.waitForURL('/')
  })

  test('error handling and recovery workflow', async ({ page }) => {
    // Override route to simulate error
    await page.route('**/data/fetch', async route => {
      await route.abort('failed')
    })
    
    await page.goto('/stock/AAPL')
    
    // Wait for error state
    await expect(page.locator('text=Failed to Load Data')).toBeVisible()
    
    // Open retry options
    await page.click('button:has-text("Retry Options")')
    await expect(page.locator('text=Force refresh (bypass cache)')).toBeVisible()
    
    // Fix the route for retry
    await page.route('**/data/fetch', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { AAPL: { data: [], date_range: { start: '', end: '' } } },
          metadata: { successful_tickers: 1, total_tickers: 1, execution_time: 0.1 },
        }),
      })
    })
    
    // Retry with different option
    await page.click('text=Try with 1-day range')
    
    // Verify recovery
    await waitForChartLoad(page)
    await expect(page.locator('text=Failed to Load Data')).not.toBeVisible()
  })

  test('performance monitoring during workflow', async ({ page }) => {
    // Start performance measurement
    await page.goto('/stock/AAPL')
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      }
    })
    
    // Verify performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(3000)
    expect(metrics.firstContentfulPaint).toBeLessThan(2000)
    
    // Measure interaction responsiveness
    const startTime = Date.now()
    await page.click('button:has-text("1Y")')
    await waitForChartLoad(page)
    const interactionTime = Date.now() - startTime
    
    expect(interactionTime).toBeLessThan(2000)
  })

  test('mobile workflow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/stock/AAPL')
    
    // Verify mobile-optimized layout
    await expect(page.locator('h1:has-text("AAPL")')).toBeVisible()
    
    // Test mobile interactions
    const timeRangeButtons = page.locator('button').filter({ hasText: /^(1D|5D|1M|3M|6M|1Y|5Y|MAX)$/ })
    await expect(timeRangeButtons.first()).toBeVisible()
    
    // Scroll to see data table
    await page.locator('text=Recent Data').scrollIntoViewIfNeeded()
    await verifyDataTable(page)
    
    // Test touch interactions
    await page.tap('button:has-text("3M")')
    await waitForChartLoad(page)
  })

  test('keyboard-only navigation workflow', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await waitForChartLoad(page)
    
    // Navigate using only keyboard
    await page.keyboard.press('Tab') // Skip to content
    await page.keyboard.press('Tab') // Share button
    await page.keyboard.press('Tab') // Back to Portfolio
    
    // Navigate through time range buttons
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
    }
    
    // Select 6M using keyboard
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toHaveText('6M')
    await page.keyboard.press('Enter')
    
    await waitForChartLoad(page)
    
    // Continue tabbing to custom date
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toHaveText('Custom')
    await page.keyboard.press('Enter')
    
    // Fill custom dates with keyboard
    await page.keyboard.press('Tab') // Start date
    await page.keyboard.type('01012024')
    await page.keyboard.press('Tab') // End date
    await page.keyboard.type('12312024')
    await page.keyboard.press('Tab') // Apply button
    await page.keyboard.press('Enter')
    
    await waitForChartLoad(page)
  })

  test('multi-ticker comparison workflow', async ({ page }) => {
    // Start with one ticker
    await page.goto('/stock/AAPL')
    await waitForChartLoad(page)
    
    // Add another ticker for comparison (if feature exists)
    const addTickerButton = page.locator('[data-testid="add-ticker"]')
    if (await addTickerButton.isVisible()) {
      await addTickerButton.click()
      await page.fill('[data-testid="additional-ticker-input"]', 'GOOGL')
      await page.keyboard.press('Enter')
      
      // Wait for both datasets to load
      await page.waitForSelector('text=2 of 2 tickers loaded')
      
      // Verify both tickers are displayed
      await expect(page.locator('text=AAPL')).toBeVisible()
      await expect(page.locator('text=GOOGL')).toBeVisible()
    }
  })

  test('data export workflow', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await waitForChartLoad(page)
    
    // Look for export functionality
    const exportButton = page.locator('[data-testid="export-data"]')
    if (await exportButton.isVisible()) {
      // Set up download promise before clicking
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('AAPL')
      expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx|json)$/)
    }
  })

  test('real-time updates workflow', async ({ page }) => {
    let updateCount = 0
    
    // Intercept and modify responses to simulate updates
    await page.route('**/data/fetch', async route => {
      updateCount++
      const mockData = {
        data: {
          AAPL: {
            data: [{
              Date: new Date().toISOString(),
              Open: 150 + updateCount,
              High: 155 + updateCount,
              Low: 145 + updateCount,
              Close: 150 + updateCount,
              Volume: 50000000,
            }],
            date_range: {
              start: new Date().toISOString(),
              end: new Date().toISOString(),
            },
          },
        },
        metadata: {
          successful_tickers: 1,
          total_tickers: 1,
          execution_time: 0.1,
        },
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      })
    })
    
    await page.goto('/stock/AAPL')
    await waitForChartLoad(page)
    
    // Check for auto-refresh or manual refresh
    const refreshButton = page.locator('[data-testid="refresh-button"]')
    if (await refreshButton.isVisible()) {
      const initialValue = await page.locator('td').filter({ hasText: /\$\d+\.\d+/ }).first().textContent()
      
      await refreshButton.click()
      await waitForChartLoad(page)
      
      const updatedValue = await page.locator('td').filter({ hasText: /\$\d+\.\d+/ }).first().textContent()
      expect(initialValue).not.toBe(updatedValue)
    }
  })

  test('accessibility throughout workflow', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await injectAxe(page)
    
    // Check initial page
    await checkA11y(page)
    
    // Check after time range change
    await page.click('button:has-text("1Y")')
    await waitForChartLoad(page)
    await checkA11y(page)
    
    // Check custom date picker
    await page.click('button:has-text("Custom")')
    await checkA11y(page, '[data-testid="custom-date-picker"]')
    
    // Check error state
    await page.route('**/data/fetch', route => route.abort())
    await page.reload()
    await checkA11y(page, '[role="alert"]')
  })

  test('cross-browser consistency', async ({ page, browserName }) => {
    await page.goto('/stock/AAPL')
    await waitForChartLoad(page)
    
    // Take screenshots for visual comparison
    await page.screenshot({
      path: `screenshots/stock-detail-${browserName}.png`,
      fullPage: true,
    })
    
    // Verify key elements render consistently
    const elements = [
      'h1:has-text("AAPL")',
      'text=AAPL Price Chart',
      'text=Data Summary',
      'text=Recent Data',
    ]
    
    for (const selector of elements) {
      await expect(page.locator(selector)).toBeVisible()
    }
    
    // Test browser-specific features
    if (browserName === 'chromium') {
      // Test Chrome-specific features like Web Share API
      const canShare = await page.evaluate(() => 'share' in navigator)
      if (canShare) {
        // Test native share if available
      }
    }
  })
})