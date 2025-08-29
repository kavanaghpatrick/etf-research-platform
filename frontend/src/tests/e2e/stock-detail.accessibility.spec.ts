import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from 'axe-playwright'

test.describe('Stock Detail Page Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/stock/AAPL')
    await injectAxe(page)
  })

  test('meets WCAG 2.1 AA standards', async ({ page }) => {
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    })
  })

  test('keyboard navigation works correctly', async ({ page }) => {
    // Start from the top of the page
    await page.keyboard.press('Tab')
    
    // Should focus on skip link first
    const skipLink = page.locator('[data-testid="skip-to-content"]')
    await expect(skipLink).toBeFocused()
    
    // Tab through interactive elements
    const interactiveElements = [
      'time-range-selector',
      'chart-type-selector',
      'tab-overview',
      'tab-charts',
      'tab-dividends',
      'tab-performance',
      'refresh-button',
    ]
    
    for (const element of interactiveElements) {
      await page.keyboard.press('Tab')
      const focused = page.locator(`[data-testid="${element}"]`)
      await expect(focused).toBeFocused()
    }
    
    // Test reverse tabbing
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('[data-testid="refresh-button"]')).not.toBeFocused()
  })

  test('screen reader announcements work correctly', async ({ page }) => {
    // Click on different tabs and verify announcements
    await page.click('[data-testid="tab-charts"]')
    
    // Check for live region announcement
    const liveRegion = page.locator('[role="status"], [aria-live="polite"]')
    await expect(liveRegion).toContainText(/Charts tab selected/i)
    
    // Update chart time range
    await page.click('[data-testid="time-range-1M"]')
    await expect(liveRegion).toContainText(/Chart updated to show 1 month data/i)
  })

  test('focus indicators are visible', async ({ page }) => {
    // Tab to an interactive element
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    
    // Take screenshot to verify focus indicator
    const focusedElement = page.locator(':focus')
    const box = await focusedElement.boundingBox()
    
    if (box) {
      // Check that focus indicator has sufficient contrast
      await expect(page).toHaveScreenshot('focus-indicator.png', {
        clip: {
          x: box.x - 5,
          y: box.y - 5,
          width: box.width + 10,
          height: box.height + 10,
        },
      })
    }
  })

  test('ARIA labels and roles are correct', async ({ page }) => {
    // Check main landmarks
    await expect(page.locator('main')).toHaveAttribute('role', 'main')
    await expect(page.locator('nav')).toHaveAttribute('role', 'navigation')
    
    // Check chart accessibility
    const chart = page.locator('[data-testid="stock-chart"]')
    await expect(chart).toHaveAttribute('role', 'img')
    await expect(chart).toHaveAttribute('aria-label', /Stock price chart for AAPL/i)
    
    // Check tab panel associations
    const tabPanel = page.locator('[role="tabpanel"]:visible')
    await expect(tabPanel).toHaveAttribute('aria-labelledby')
    
    // Check form controls
    const selectors = page.locator('select, button, input')
    const count = await selectors.count()
    
    for (let i = 0; i < count; i++) {
      const element = selectors.nth(i)
      const tagName = await element.evaluate(el => el.tagName.toLowerCase())
      
      if (tagName === 'button') {
        await expect(element).toHaveAttribute('aria-label')
      } else if (tagName === 'select' || tagName === 'input') {
        const id = await element.getAttribute('id')
        if (id) {
          await expect(page.locator(`label[for="${id}"]`)).toBeVisible()
        }
      }
    }
  })

  test('color contrast meets standards', async ({ page }) => {
    // Check specific elements for color contrast
    await checkA11y(page, '[data-testid="stock-price"]', {
      rules: {
        'color-contrast': { enabled: true },
      },
    })
    
    await checkA11y(page, '[data-testid="stock-change"]', {
      rules: {
        'color-contrast': { enabled: true },
      },
    })
  })

  test('headings have proper hierarchy', async ({ page }) => {
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
    const headingLevels: number[] = []
    
    for (const heading of headings) {
      const tagName = await heading.evaluate(el => el.tagName)
      headingLevels.push(parseInt(tagName.charAt(1)))
    }
    
    // Check that heading levels don't skip
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1]
      expect(diff).toBeLessThanOrEqual(1)
    }
    
    // Should have exactly one h1
    const h1Count = headingLevels.filter(level => level === 1).length
    expect(h1Count).toBe(1)
  })

  test('forms are accessible', async ({ page }) => {
    // Check time range selector
    const timeRangeForm = page.locator('[data-testid="time-range-form"]')
    
    // All form inputs should have labels
    const inputs = timeRangeForm.locator('input, select')
    const inputCount = await inputs.count()
    
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i)
      const id = await input.getAttribute('id')
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`)
        await expect(label).toBeVisible()
      } else {
        // Input should have aria-label if no associated label
        await expect(input).toHaveAttribute('aria-label')
      }
    }
  })

  test('error messages are accessible', async ({ page }) => {
    // Trigger an error (e.g., by disconnecting network)
    await page.route('**/api/**', route => route.abort())
    await page.reload()
    
    // Wait for error message
    const errorMessage = page.locator('[role="alert"]')
    await expect(errorMessage).toBeVisible()
    
    // Error should be announced to screen readers
    await expect(errorMessage).toHaveAttribute('aria-live', 'assertive')
    
    // Error should be associated with relevant controls
    const retryButton = page.locator('[data-testid="retry-button"]')
    await expect(retryButton).toHaveAttribute('aria-describedby')
  })

  test('loading states are accessible', async ({ page }) => {
    // Slow down API responses
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.continue()
    })
    
    await page.reload()
    
    // Check loading indicator
    const loadingIndicator = page.locator('[data-testid="loading-spinner"]')
    await expect(loadingIndicator).toHaveAttribute('role', 'status')
    await expect(loadingIndicator).toHaveAttribute('aria-label', /Loading/i)
    
    // Check that loading state is announced
    const liveRegion = page.locator('[aria-live="polite"]')
    await expect(liveRegion).toContainText(/Loading stock data/i)
  })

  test('responsive design maintains accessibility', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ]
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport)
      
      // Run accessibility checks at each viewport
      await checkA11y(page, null, {
        detailedReport: false,
      })
      
      // Verify mobile menu is accessible
      if (viewport.name === 'mobile') {
        const mobileMenu = page.locator('[data-testid="mobile-menu-button"]')
        await expect(mobileMenu).toBeVisible()
        await expect(mobileMenu).toHaveAttribute('aria-expanded', 'false')
        
        await mobileMenu.click()
        await expect(mobileMenu).toHaveAttribute('aria-expanded', 'true')
      }
    }
  })

  test('reduced motion preferences are respected', async ({ page, browserName }) => {
    // Skip this test in WebKit as it doesn't support prefers-reduced-motion well
    test.skip(browserName === 'webkit', 'WebKit does not support prefers-reduced-motion')
    
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.reload()
    
    // Check that animations are disabled
    const animatedElements = page.locator('[data-animated="true"]')
    const count = await animatedElements.count()
    
    for (let i = 0; i < count; i++) {
      const element = animatedElements.nth(i)
      const styles = await element.evaluate(el => window.getComputedStyle(el))
      
      expect(styles.animationDuration).toBe('0s')
      expect(styles.transitionDuration).toBe('0s')
    }
  })
})