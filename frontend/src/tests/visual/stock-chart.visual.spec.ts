import { test, expect } from '@playwright/test'
import { mockResponses, apiEndpoints } from '../test-utils/api-test-utils'

test.describe('StockChart Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route(apiEndpoints.chart('AAPL', '1D'), async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.chartData(100)),
      })
    })

    await page.route(apiEndpoints.stock('AAPL'), async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.stock()),
      })
    })
  })

  test('default chart appearance', async ({ page }) => {
    await page.goto('/stock/AAPL')
    
    // Wait for chart to render
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')
    
    // Hide dynamic elements
    await page.evaluate(() => {
      // Hide timestamps
      document.querySelectorAll('[data-testid*="timestamp"]').forEach(el => {
        (el as HTMLElement).textContent = '00:00'
      })
      // Hide prices that might fluctuate
      document.querySelectorAll('[data-testid*="current-price"]').forEach(el => {
        (el as HTMLElement).textContent = '$150.00'
      })
    })

    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot('stock-chart-default.png')
  })

  test('chart with different time ranges', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')

    const timeRanges = ['1D', '1W', '1M', '3M', '1Y', '5Y']
    
    for (const range of timeRanges) {
      await page.click(`[data-testid="time-range-${range}"]`)
      await page.waitForTimeout(500) // Wait for animation
      
      await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
        `stock-chart-${range.toLowerCase()}.png`
      )
    }
  })

  test('chart loading state', async ({ page }) => {
    // Delay the API response
    await page.route(apiEndpoints.chart('AAPL', '1D'), async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponses.chartData(100)),
      })
    })

    await page.goto('/stock/AAPL')
    
    // Capture loading state
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot('stock-chart-loading.png')
  })

  test('chart error state', async ({ page }) => {
    await page.route(apiEndpoints.chart('AAPL', '1D'), async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server Error' }),
      })
    })

    await page.goto('/stock/AAPL')
    await page.waitForSelector('[data-testid="chart-error"]')
    
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot('stock-chart-error.png')
  })

  test('chart hover interactions', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')

    // Hover over chart to show tooltip
    const chart = page.locator('[data-testid="chart-canvas"]')
    await chart.hover({ position: { x: 200, y: 150 } })
    await page.waitForSelector('[role="tooltip"]')

    // Normalize tooltip content
    await page.evaluate(() => {
      const tooltip = document.querySelector('[role="tooltip"]')
      if (tooltip) {
        tooltip.querySelectorAll('[data-dynamic]').forEach(el => {
          (el as HTMLElement).textContent = '[DYNAMIC]'
        })
      }
    })

    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot('stock-chart-tooltip.png')
  })

  test('chart responsiveness', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-hd' },
      { width: 1366, height: 768, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 812, name: 'mobile' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto('/stock/AAPL')
      await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')
      
      await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
        `stock-chart-${viewport.name}.png`
      )
    }
  })

  test('chart theme variations', async ({ page, browserName }) => {
    // Light theme
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      `stock-chart-light-${browserName}.png`
    )

    // Dark theme
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.reload()
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      `stock-chart-dark-${browserName}.png`
    )

    // High contrast
    await page.emulateMedia({ forcedColors: 'active' })
    await page.reload()
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      `stock-chart-high-contrast-${browserName}.png`
    )
  })

  test('chart animations disabled', async ({ page }) => {
    // Disable animations for users who prefer reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')

    // Switch time range to trigger potential animation
    await page.click('[data-testid="time-range-1M"]')
    
    // Should switch immediately without animation
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      'stock-chart-reduced-motion.png'
    )
  })

  test('chart with indicators', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')

    // Enable various indicators
    const indicators = ['SMA', 'EMA', 'RSI', 'MACD', 'Volume']
    
    for (const indicator of indicators) {
      await page.click(`[data-testid="indicator-toggle-${indicator}"]`)
      await page.waitForTimeout(300) // Wait for indicator to render
    }

    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      'stock-chart-with-indicators.png'
    )
  })

  test('chart print view', async ({ page }) => {
    await page.goto('/stock/AAPL')
    await page.waitForSelector('[role="img"][aria-label*="Stock price chart"]')

    // Emulate print media
    await page.emulateMedia({ media: 'print' })
    
    await expect(page.locator('[data-testid="stock-chart"]')).toHaveScreenshot(
      'stock-chart-print.png'
    )
  })
})