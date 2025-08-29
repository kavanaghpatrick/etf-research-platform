import { test, expect } from '@playwright/test'

// Helper to normalize dynamic content
async function normalizeDynamicContent(page) {
  await page.evaluate(() => {
    // Normalize timestamps
    document.querySelectorAll('[data-testid*="timestamp"], [data-testid*="time"], .timestamp').forEach(el => {
      (el as HTMLElement).textContent = '2024-01-01 00:00:00'
    })
    
    // Normalize prices
    document.querySelectorAll('[data-testid*="price"], .price').forEach(el => {
      (el as HTMLElement).textContent = '$150.00'
    })
    
    // Normalize percentages
    document.querySelectorAll('[data-testid*="percent"], .percent').forEach(el => {
      (el as HTMLElement).textContent = '+1.50%'
    })
    
    // Normalize dates
    document.querySelectorAll('[data-testid*="date"], .date').forEach(el => {
      (el as HTMLElement).textContent = '01/01/2024'
    })
  })
}

test.describe('Component Visual Regression Tests', () => {
  test.describe('TimeRangeSelector', () => {
    test('default state', async ({ page }) => {
      await page.goto('/test-components#time-range-selector')
      const component = page.locator('[data-testid="time-range-selector"]')
      await expect(component).toHaveScreenshot('time-range-selector-default.png')
    })

    test('selected states', async ({ page }) => {
      await page.goto('/test-components#time-range-selector')
      const component = page.locator('[data-testid="time-range-selector"]')
      
      const ranges = ['1D', '1M', '3M', '6M', '1Y']
      for (const range of ranges) {
        await page.click(`button:has-text("${range}")`)
        await expect(component).toHaveScreenshot(`time-range-selector-${range.toLowerCase()}.png`)
      }
    })

    test('custom date picker open', async ({ page }) => {
      await page.goto('/test-components#time-range-selector')
      await page.click('button:has-text("Custom")')
      
      const component = page.locator('[data-testid="time-range-selector"]')
      await expect(component).toHaveScreenshot('time-range-selector-custom-open.png')
    })

    test('disabled state', async ({ page }) => {
      await page.goto('/test-components#time-range-selector-disabled')
      const component = page.locator('[data-testid="time-range-selector"]')
      await expect(component).toHaveScreenshot('time-range-selector-disabled.png')
    })
  })

  test.describe('StockDetailPage', () => {
    test('loading state', async ({ page }) => {
      await page.route('**/data/fetch', async route => {
        await new Promise(resolve => setTimeout(resolve, 5000))
      })
      
      await page.goto('/stock/AAPL')
      await normalizeDynamicContent(page)
      await expect(page).toHaveScreenshot('stock-detail-loading.png', { fullPage: true })
    })

    test('data loaded state', async ({ page }) => {
      await page.route('**/data/fetch', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              AAPL: {
                data: Array.from({ length: 10 }, (_, i) => ({
                  Date: '2024-01-01',
                  Open: 150,
                  High: 155,
                  Low: 149,
                  Close: 154,
                  Volume: 1000000,
                })),
                date_range: { start: '2024-01-01', end: '2024-01-10' },
              },
            },
            metadata: {
              successful_tickers: 1,
              total_tickers: 1,
              execution_time: 0.523,
            },
          }),
        })
      })
      
      await page.goto('/stock/AAPL')
      await page.waitForSelector('text=AAPL Price Chart')
      await normalizeDynamicContent(page)
      await expect(page).toHaveScreenshot('stock-detail-loaded.png', { fullPage: true })
    })

    test('error state', async ({ page }) => {
      await page.route('**/data/fetch', async route => {
        await route.abort()
      })
      
      await page.goto('/stock/AAPL')
      await page.waitForSelector('text=Failed to Load Data')
      await expect(page).toHaveScreenshot('stock-detail-error.png', { fullPage: true })
    })

    test('error state with retry options', async ({ page }) => {
      await page.route('**/data/fetch', async route => {
        await route.abort()
      })
      
      await page.goto('/stock/AAPL')
      await page.waitForSelector('text=Failed to Load Data')
      await page.click('button:has-text("Retry Options")')
      await expect(page).toHaveScreenshot('stock-detail-error-retry-options.png', { fullPage: true })
    })
  })

  test.describe('LoadingSpinner', () => {
    test('default spinner', async ({ page }) => {
      await page.goto('/test-components#loading-spinner')
      const spinner = page.locator('[data-testid="loading-spinner"]')
      await expect(spinner).toHaveScreenshot('loading-spinner-default.png')
    })

    test('spinner with text', async ({ page }) => {
      await page.goto('/test-components#loading-spinner-with-text')
      const container = page.locator('[data-testid="loading-container"]')
      await expect(container).toHaveScreenshot('loading-spinner-with-text.png')
    })
  })

  test.describe('ErrorBoundary', () => {
    test('error fallback UI', async ({ page }) => {
      await page.goto('/test-components#error-boundary-trigger')
      await page.click('button:has-text("Trigger Error")')
      
      const errorUI = page.locator('[data-testid="error-boundary-fallback"]')
      await expect(errorUI).toHaveScreenshot('error-boundary-fallback.png')
    })
  })

  test.describe('AccessibilityStates', () => {
    test('focus states', async ({ page }) => {
      await page.goto('/test-components#accessibility-states')
      
      // Focus on different elements
      const elements = ['button', 'input', 'select', 'a']
      for (const element of elements) {
        await page.focus(element)
        await expect(page.locator(element)).toHaveScreenshot(`focus-state-${element}.png`)
      }
    })

    test('hover states', async ({ page }) => {
      await page.goto('/test-components#accessibility-states')
      
      const button = page.locator('button').first()
      await button.hover()
      await expect(button).toHaveScreenshot('hover-state-button.png')
    })

    test('disabled states', async ({ page }) => {
      await page.goto('/test-components#accessibility-states-disabled')
      
      const container = page.locator('[data-testid="disabled-states"]')
      await expect(container).toHaveScreenshot('disabled-states-all.png')
    })
  })

  test.describe('Responsive Layouts', () => {
    const viewports = [
      { width: 320, height: 568, name: 'mobile-small' },
      { width: 375, height: 812, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1024, height: 768, name: 'desktop' },
      { width: 1920, height: 1080, name: 'desktop-hd' },
    ]

    for (const viewport of viewports) {
      test(`stock detail at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        
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
        
        await page.goto('/stock/AAPL')
        await page.waitForTimeout(500) // Wait for responsive adjustments
        await normalizeDynamicContent(page)
        
        await expect(page).toHaveScreenshot(`stock-detail-${viewport.name}.png`, {
          fullPage: true,
          maxDiffPixels: 100, // Allow small differences due to responsive calculations
        })
      })
    }
  })

  test.describe('Theme Variations', () => {
    test('light theme', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/stock/AAPL')
      await normalizeDynamicContent(page)
      await expect(page).toHaveScreenshot('theme-light.png', { fullPage: true })
    })

    test('dark theme', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/stock/AAPL')
      await normalizeDynamicContent(page)
      await expect(page).toHaveScreenshot('theme-dark.png', { fullPage: true })
    })

    test('high contrast mode', async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit does not support forced-colors')
      
      await page.emulateMedia({ forcedColors: 'active' })
      await page.goto('/stock/AAPL')
      await normalizeDynamicContent(page)
      await expect(page).toHaveScreenshot('theme-high-contrast.png', { fullPage: true })
    })
  })

  test.describe('Animation States', () => {
    test('with animations', async ({ page }) => {
      await page.goto('/stock/AAPL')
      
      // Trigger an animation
      await page.click('button:has-text("3M")')
      
      // Capture mid-animation
      await page.waitForTimeout(150)
      await expect(page.locator('[data-testid="time-range-selector"]')).toHaveScreenshot(
        'animation-in-progress.png'
      )
    })

    test('reduced motion', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/stock/AAPL')
      
      // Trigger what would normally animate
      await page.click('button:has-text("3M")')
      
      // Should change instantly
      await expect(page.locator('[data-testid="time-range-selector"]')).toHaveScreenshot(
        'animation-reduced-motion.png'
      )
    })
  })

  test.describe('Print Styles', () => {
    test('print preview', async ({ page }) => {
      await page.route('**/data/fetch', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              AAPL: {
                data: Array.from({ length: 5 }, () => ({
                  Date: '2024-01-01',
                  Open: 150,
                  High: 155,
                  Low: 149,
                  Close: 154,
                  Volume: 1000000,
                })),
                date_range: { start: '2024-01-01', end: '2024-01-05' },
              },
            },
            metadata: {
              successful_tickers: 1,
              total_tickers: 1,
              execution_time: 0.1,
            },
          }),
        })
      })
      
      await page.goto('/stock/AAPL')
      await page.waitForSelector('text=Recent Data')
      await page.emulateMedia({ media: 'print' })
      await normalizeDynamicContent(page)
      
      await expect(page).toHaveScreenshot('print-preview.png', { fullPage: true })
    })
  })

  test.describe('Component States Matrix', () => {
    test('button states', async ({ page }) => {
      await page.goto('/test-components#button-states')
      
      const states = ['default', 'hover', 'focus', 'active', 'disabled']
      const variants = ['primary', 'secondary', 'danger']
      
      for (const variant of variants) {
        for (const state of states) {
          const button = page.locator(`[data-testid="button-${variant}-${state}"]`)
          
          if (state === 'hover') {
            await button.hover()
          } else if (state === 'focus') {
            await button.focus()
          } else if (state === 'active') {
            await page.mouse.move(100, 100)
            await page.mouse.down()
          }
          
          await expect(button).toHaveScreenshot(`button-${variant}-${state}.png`)
          
          if (state === 'active') {
            await page.mouse.up()
          }
        }
      }
    })
  })

  test.describe('Cross-Browser Consistency', () => {
    test('component rendering', async ({ page, browserName }) => {
      await page.goto('/stock/AAPL')
      await normalizeDynamicContent(page)
      
      // Take browser-specific screenshots for comparison
      await expect(page.locator('[data-testid="time-range-selector"]')).toHaveScreenshot(
        `time-range-selector-${browserName}.png`
      )
      
      await expect(page.locator('h1:has-text("AAPL")')).toHaveScreenshot(
        `stock-header-${browserName}.png`
      )
    })
  })
})