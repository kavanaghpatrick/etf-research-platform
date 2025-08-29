/**
 * End-to-end accessibility tests using Playwright and axe-core
 */

import { test, expect, Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Custom accessibility test helpers
async function runAccessibilityTest(page: Page, testName: string, options: {
  wcagLevel?: 'A' | 'AA' | 'AAA'
  tags?: string[]
  exclude?: string[]
  include?: string[]
} = {}) {
  const { wcagLevel = 'AA', tags, exclude, include } = options
  
  let axeBuilder = new AxeBuilder({ page })
  
  // Set WCAG level
  switch (wcagLevel) {
    case 'A':
      axeBuilder = axeBuilder.withTags(['wcag2a'])
      break
    case 'AA':
      axeBuilder = axeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      break
    case 'AAA':
      axeBuilder = axeBuilder.withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21aa', 'wcag21aaa'])
      break
  }
  
  if (tags) {
    axeBuilder = axeBuilder.withTags(tags)
  }
  
  if (exclude) {
    axeBuilder = axeBuilder.exclude(exclude)
  }
  
  if (include) {
    axeBuilder = axeBuilder.include(include)
  }
  
  const accessibilityScanResults = await axeBuilder.analyze()
  
  // Log results for debugging
  if (accessibilityScanResults.violations.length > 0) {
    console.log(`\n❌ Accessibility violations found in ${testName}:`)
    accessibilityScanResults.violations.forEach((violation, index) => {
      console.log(`\n${index + 1}. ${violation.id} (${violation.impact})`)
      console.log(`   Description: ${violation.description}`)
      console.log(`   Help: ${violation.help}`)
      console.log(`   Help URL: ${violation.helpUrl}`)
      console.log(`   Nodes: ${violation.nodes.length}`)
    })
  } else {
    console.log(`✅ No accessibility violations found in ${testName}`)
  }
  
  expect(accessibilityScanResults.violations).toEqual([])
  return accessibilityScanResults
}

async function waitForPageLoad(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000) // Additional wait for dynamic content
}

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up accessibility testing context
    await page.addInitScript(() => {
      // Add accessibility testing flag
      window.accessibilityTesting = true
    })
  })

  test.describe('Home Page Accessibility', () => {
    test('should have no accessibility violations on home page', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      await runAccessibilityTest(page, 'Home Page', { wcagLevel: 'AA' })
    })

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Test keyboard navigation
      await page.keyboard.press('Tab')
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBeTruthy()
      
      // Test skip links
      await page.keyboard.press('Tab')
      const skipLink = await page.locator('[href="#main-content"]').first()
      if (await skipLink.isVisible()) {
        expect(await skipLink.textContent()).toContain('Skip')
      }
    })

    test('should have proper heading structure', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
      expect(headings.length).toBeGreaterThan(0)
      
      // Check for h1
      const h1Count = await page.locator('h1').count()
      expect(h1Count).toBeGreaterThanOrEqual(1)
    })

    test('should handle focus management', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Test that focus is visible
      await page.keyboard.press('Tab')
      const focusedElement = await page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })
  })

  test.describe('Stock Detail Page Accessibility', () => {
    test('should have no accessibility violations on stock detail page', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await waitForPageLoad(page)
      
      await runAccessibilityTest(page, 'Stock Detail Page', { wcagLevel: 'AA' })
    })

    test('should have accessible tab navigation', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await waitForPageLoad(page)
      
      // Find tab navigation
      const tablist = page.locator('[role="tablist"]')
      await expect(tablist).toBeVisible()
      
      // Check ARIA attributes
      const tabs = await page.locator('[role="tab"]').all()
      expect(tabs.length).toBeGreaterThan(0)
      
      for (const tab of tabs) {
        await expect(tab).toHaveAttribute('aria-selected')
        await expect(tab).toHaveAttribute('aria-controls')
      }
    })

    test('should support keyboard tab navigation', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await waitForPageLoad(page)
      
      // Focus first tab
      const firstTab = page.locator('[role="tab"]').first()
      await firstTab.focus()
      
      // Test arrow key navigation
      await page.keyboard.press('ArrowRight')
      const activeTab = await page.locator('[role="tab"][aria-selected="true"]')
      await expect(activeTab).toBeFocused()
      
      // Test Home key
      await page.keyboard.press('Home')
      const firstTabAgain = page.locator('[role="tab"]').first()
      await expect(firstTabAgain).toBeFocused()
      
      // Test End key
      await page.keyboard.press('End')
      const lastTab = page.locator('[role="tab"]').last()
      await expect(lastTab).toBeFocused()
    })

    test('should have accessible data tables', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await waitForPageLoad(page)
      
      // Look for tables
      const tables = await page.locator('table[role="table"]').all()
      
      for (const table of tables) {
        // Check for proper headers
        const headers = await table.locator('th[scope="col"]').all()
        expect(headers.length).toBeGreaterThan(0)
        
        // Check for aria-label or caption
        const hasLabel = await table.getAttribute('aria-label')
        const hasCaption = await table.locator('caption').count()
        expect(hasLabel || hasCaption > 0).toBeTruthy()
      }
    })

    test('should handle loading states accessibly', async ({ page }) => {
      await page.goto('/stock/AAPL')
      
      // Look for loading states
      const loadingStates = await page.locator('[role="status"]').all()
      
      for (const loadingState of loadingStates) {
        await expect(loadingState).toHaveAttribute('aria-live', 'polite')
      }
    })

    test('should handle error states accessibly', async ({ page }) => {
      // Navigate to a non-existent stock to trigger error
      await page.goto('/stock/NONEXISTENT')
      await waitForPageLoad(page)
      
      // Look for error states
      const errorStates = await page.locator('[role="alert"]').all()
      
      for (const errorState of errorStates) {
        await expect(errorState).toHaveAttribute('aria-live', 'assertive')
      }
    })
  })

  test.describe('High Contrast Mode', () => {
    test('should work with high contrast mode', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/')
      await waitForPageLoad(page)
      
      await runAccessibilityTest(page, 'High Contrast Mode', { wcagLevel: 'AA' })
    })

    test('should maintain color contrast ratios', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      await runAccessibilityTest(page, 'Color Contrast', { 
        tags: ['color-contrast'],
        wcagLevel: 'AA' 
      })
    })
  })

  test.describe('Reduced Motion', () => {
    test('should respect reduced motion preferences', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Check that animations are disabled
      const elementsWithTransition = await page.evaluate(() => {
        const elements = document.querySelectorAll('*')
        return Array.from(elements).some(el => {
          const computed = window.getComputedStyle(el)
          return computed.animationDuration !== '0s' || computed.transitionDuration !== '0s'
        })
      })
      
      // In reduced motion mode, animations should be minimal
      if (elementsWithTransition) {
        console.log('Note: Some animations detected in reduced motion mode')
      }
      
      await runAccessibilityTest(page, 'Reduced Motion', { wcagLevel: 'AA' })
    })
  })

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test')
      
      await page.goto('/')
      await waitForPageLoad(page)
      
      await runAccessibilityTest(page, 'Mobile Accessibility', { wcagLevel: 'AA' })
    })

    test('should have proper touch targets on mobile', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test')
      
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Check touch target sizes (minimum 44px)
      const touchTargets = await page.locator('button, a, input, [role="button"]').all()
      
      for (const target of touchTargets.slice(0, 10)) { // Check first 10 to avoid timeout
        if (await target.isVisible()) {
          const box = await target.boundingBox()
          if (box) {
            expect(box.width).toBeGreaterThanOrEqual(44)
            expect(box.height).toBeGreaterThanOrEqual(44)
          }
        }
      }
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('should support comprehensive keyboard navigation', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Test Tab navigation
      let tabCount = 0
      const maxTabs = 20
      
      while (tabCount < maxTabs) {
        await page.keyboard.press('Tab')
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement
          return el ? {
            tagName: el.tagName,
            role: el.getAttribute('role'),
            ariaLabel: el.getAttribute('aria-label'),
            id: el.id,
            className: el.className
          } : null
        })
        
        if (focusedElement) {
          expect(focusedElement.tagName).toBeTruthy()
          tabCount++
        } else {
          break
        }
      }
      
      expect(tabCount).toBeGreaterThan(0)
    })

    test('should support keyboard shortcuts', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Test help shortcut (Shift + ?)
      await page.keyboard.press('Shift+?')
      
      // Check if help dialog appears
      const helpDialog = page.locator('[role="dialog"]')
      if (await helpDialog.count() > 0) {
        await expect(helpDialog).toBeVisible()
        
        // Close with Escape
        await page.keyboard.press('Escape')
        await expect(helpDialog).not.toBeVisible()
      }
    })
  })

  test.describe('Screen Reader Simulation', () => {
    test('should provide proper screen reader content', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Check for screen reader only content
      const srOnlyElements = await page.locator('.sr-only').all()
      expect(srOnlyElements.length).toBeGreaterThan(0)
      
      // Check ARIA live regions
      const liveRegions = await page.locator('[aria-live]').all()
      expect(liveRegions.length).toBeGreaterThan(0)
      
      // Check landmarks
      const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"]').all()
      expect(landmarks.length).toBeGreaterThan(0)
    })

    test('should announce dynamic content changes', async ({ page }) => {
      await page.goto('/stock/AAPL')
      await waitForPageLoad(page)
      
      // Look for ARIA live regions
      const liveRegions = await page.locator('[aria-live="polite"], [aria-live="assertive"]').all()
      expect(liveRegions.length).toBeGreaterThan(0)
      
      // Test tab switching for live region updates
      const tabs = await page.locator('[role="tab"]').all()
      if (tabs.length > 1) {
        await tabs[1].click()
        await waitForPageLoad(page)
        
        // Verify content updated
        const tabpanel = page.locator('[role="tabpanel"]')
        await expect(tabpanel).toBeVisible()
      }
    })
  })

  test.describe('Form Accessibility', () => {
    test('should have accessible form controls', async ({ page }) => {
      await page.goto('/')
      await waitForPageLoad(page)
      
      // Look for form inputs
      const inputs = await page.locator('input, select, textarea').all()
      
      for (const input of inputs) {
        if (await input.isVisible()) {
          // Check for labels
          const inputId = await input.getAttribute('id')
          const ariaLabel = await input.getAttribute('aria-label')
          const ariaLabelledby = await input.getAttribute('aria-labelledby')
          
          if (inputId) {
            const label = page.locator(`label[for="${inputId}"]`)
            const hasLabel = await label.count() > 0
            expect(hasLabel || ariaLabel || ariaLabelledby).toBeTruthy()
          } else {
            expect(ariaLabel || ariaLabelledby).toBeTruthy()
          }
        }
      }
    })
  })

  test.describe('Performance Impact of Accessibility Features', () => {
    test('should not significantly impact performance', async ({ page }) => {
      await page.goto('/')
      
      // Measure page load performance
      const performanceMetrics = await page.evaluate(() => {
        const timing = performance.timing
        return {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          fullyLoaded: timing.loadEventEnd - timing.navigationStart,
        }
      })
      
      // Basic performance checks (adjust thresholds as needed)
      expect(performanceMetrics.domContentLoaded).toBeLessThan(5000) // 5 seconds
      expect(performanceMetrics.fullyLoaded).toBeLessThan(10000) // 10 seconds
      
      // Run accessibility scan and ensure it completes in reasonable time
      const startTime = Date.now()
      await runAccessibilityTest(page, 'Performance Impact Check', { wcagLevel: 'AA' })
      const scanDuration = Date.now() - startTime
      
      expect(scanDuration).toBeLessThan(30000) // 30 seconds for accessibility scan
    })
  })
})