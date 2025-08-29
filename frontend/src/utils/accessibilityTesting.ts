/**
 * Accessibility testing utilities using axe-core
 * Provides comprehensive accessibility testing helpers for components and pages
 */

import { axe, toHaveNoViolations } from 'jest-axe'
import { render, RenderResult } from '@testing-library/react'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

export interface AccessibilityTestOptions {
  rules?: string[]
  excludeRules?: string[]
  tags?: string[]
  level?: 'A' | 'AA' | 'AAA'
  include?: string[]
  exclude?: string[]
  timeout?: number
}

export interface AccessibilityViolation {
  id: string
  impact: 'minor' | 'moderate' | 'serious' | 'critical'
  description: string
  help: string
  helpUrl: string
  tags: string[]
  nodes: Array<{
    html: string
    target: string[]
    failureSummary: string
  }>
}

export interface AccessibilityTestResult {
  violations: AccessibilityViolation[]
  passes: number
  incomplete: number
  inaccessible: number
  url: string
  timestamp: string
  testDuration: number
}

/**
 * Default accessibility test configuration
 */
const defaultConfig = {
  rules: {
    // Enable all WCAG 2.1 rules
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-labels': { enabled: true },
    'semantic-structure': { enabled: true },
    'screen-reader': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  timeout: 10000,
}

/**
 * Enhanced axe configuration for comprehensive testing
 */
const getAxeConfig = (options: AccessibilityTestOptions = {}) => {
  const {
    rules = [],
    excludeRules = [],
    tags = defaultConfig.tags,
    level = 'AA',
    include = [],
    exclude = [],
  } = options

  const config: any = {
    tags,
    rules: {},
  }

  // Include specific rules if provided
  if (rules.length > 0) {
    rules.forEach(rule => {
      config.rules[rule] = { enabled: true }
    })
  }

  // Exclude specific rules if provided
  if (excludeRules.length > 0) {
    excludeRules.forEach(rule => {
      config.rules[rule] = { enabled: false }
    })
  }

  // Set WCAG level
  switch (level) {
    case 'A':
      config.tags = ['wcag2a']
      break
    case 'AA':
      config.tags = ['wcag2a', 'wcag2aa', 'wcag21aa']
      break
    case 'AAA':
      config.tags = ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21aa', 'wcag21aaa']
      break
  }

  // Set context for include/exclude selectors
  if (include.length > 0 || exclude.length > 0) {
    config.context = {}
    if (include.length > 0) config.context.include = include
    if (exclude.length > 0) config.context.exclude = exclude
  }

  return config
}

/**
 * Test a rendered component for accessibility violations
 */
export async function testAccessibility(
  renderResult: RenderResult,
  options: AccessibilityTestOptions = {}
): Promise<AccessibilityTestResult> {
  const startTime = Date.now()
  const { container } = renderResult

  try {
    const config = getAxeConfig(options)
    const results = await axe(container, config)

    const testResult: AccessibilityTestResult = {
      violations: results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact as any,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        tags: violation.tags,
        nodes: violation.nodes.map(node => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary || 'No failure summary available',
        })),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      inaccessible: results.inapplicable.length,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - startTime,
    }

    return testResult
  } catch (error) {
    throw new Error(`Accessibility testing failed: ${error}`)
  }
}

/**
 * Test component for specific accessibility rules
 */
export async function testSpecificRules(
  renderResult: RenderResult,
  rules: string[],
  options: Omit<AccessibilityTestOptions, 'rules'> = {}
): Promise<AccessibilityTestResult> {
  return testAccessibility(renderResult, { ...options, rules })
}

/**
 * Test component for WCAG compliance level
 */
export async function testWCAGCompliance(
  renderResult: RenderResult,
  level: 'A' | 'AA' | 'AAA' = 'AA',
  options: Omit<AccessibilityTestOptions, 'level'> = {}
): Promise<AccessibilityTestResult> {
  return testAccessibility(renderResult, { ...options, level })
}

/**
 * Test keyboard navigation
 */
export async function testKeyboardNavigation(
  renderResult: RenderResult
): Promise<AccessibilityTestResult> {
  return testSpecificRules(renderResult, [
    'keyboard',
    'focus-order-semantics',
    'focusable-content',
    'tabindex',
    'bypass'
  ])
}

/**
 * Test screen reader compatibility
 */
export async function testScreenReaderCompatibility(
  renderResult: RenderResult
): Promise<AccessibilityTestResult> {
  return testSpecificRules(renderResult, [
    'aria-allowed-attr',
    'aria-command-name',
    'aria-hidden-body',
    'aria-hidden-focus',
    'aria-input-field-name',
    'aria-label',
    'aria-labelledby',
    'aria-required-attr',
    'aria-required-children',
    'aria-required-parent',
    'aria-roles',
    'aria-toggle-field-name',
    'aria-valid-attr',
    'aria-valid-attr-value',
    'image-alt',
    'input-image-alt',
    'label',
    'link-name'
  ])
}

/**
 * Test color contrast
 */
export async function testColorContrast(
  renderResult: RenderResult
): Promise<AccessibilityTestResult> {
  return testSpecificRules(renderResult, [
    'color-contrast',
    'color-contrast-enhanced'
  ])
}

/**
 * Test form accessibility
 */
export async function testFormAccessibility(
  renderResult: RenderResult
): Promise<AccessibilityTestResult> {
  return testSpecificRules(renderResult, [
    'label',
    'label-title-only',
    'form-field-multiple-labels',
    'fieldset-legend',
    'duplicate-id',
    'input-image-alt',
    'aria-input-field-name',
    'aria-toggle-field-name'
  ])
}

/**
 * Generate accessibility report
 */
export function generateAccessibilityReport(
  results: AccessibilityTestResult[]
): {
  summary: {
    totalTests: number
    totalViolations: number
    criticalViolations: number
    seriousViolations: number
    moderateViolations: number
    minorViolations: number
    passRate: number
  }
  violationsByRule: Record<string, number>
  violationsByImpact: Record<string, number>
  recommendations: string[]
} {
  const allViolations = results.flatMap(result => result.violations)
  
  const violationsByRule = allViolations.reduce((acc, violation) => {
    acc[violation.id] = (acc[violation.id] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const violationsByImpact = allViolations.reduce((acc, violation) => {
    acc[violation.impact] = (acc[violation.impact] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalTests = results.length
  const totalViolations = allViolations.length
  const totalPasses = results.reduce((sum, result) => sum + result.passes, 0)
  const passRate = totalTests > 0 ? ((totalPasses / (totalPasses + totalViolations)) * 100) : 0

  // Generate recommendations based on most common violations
  const recommendations: string[] = []
  const topViolations = Object.entries(violationsByRule)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  topViolations.forEach(([rule, count]) => {
    switch (rule) {
      case 'color-contrast':
        recommendations.push(`Improve color contrast ratios (${count} instances found)`)
        break
      case 'aria-label':
        recommendations.push(`Add ARIA labels to interactive elements (${count} instances found)`)
        break
      case 'keyboard':
        recommendations.push(`Ensure all interactive elements are keyboard accessible (${count} instances found)`)
        break
      case 'focus-order-semantics':
        recommendations.push(`Review and fix focus order issues (${count} instances found)`)
        break
      case 'image-alt':
        recommendations.push(`Add alternative text to images (${count} instances found)`)
        break
      default:
        recommendations.push(`Address ${rule} violations (${count} instances found)`)
    }
  })

  return {
    summary: {
      totalTests,
      totalViolations,
      criticalViolations: violationsByImpact.critical || 0,
      seriousViolations: violationsByImpact.serious || 0,
      moderateViolations: violationsByImpact.moderate || 0,
      minorViolations: violationsByImpact.minor || 0,
      passRate: Math.round(passRate * 100) / 100,
    },
    violationsByRule,
    violationsByImpact,
    recommendations,
  }
}

/**
 * Accessibility test helper for Jest
 */
export const accessibilityTestHelper = {
  /**
   * Assert that a component has no accessibility violations
   */
  async toBeAccessible(
    renderResult: RenderResult,
    options: AccessibilityTestOptions = {}
  ) {
    const results = await testAccessibility(renderResult, options)
    expect(results.violations).toHaveLength(0)
    return results
  },

  /**
   * Assert that a component meets WCAG level
   */
  async toMeetWCAGLevel(
    renderResult: RenderResult,
    level: 'A' | 'AA' | 'AAA' = 'AA'
  ) {
    const results = await testWCAGCompliance(renderResult, level)
    expect(results.violations).toHaveLength(0)
    return results
  },

  /**
   * Assert that a component is keyboard accessible
   */
  async toBeKeyboardAccessible(renderResult: RenderResult) {
    const results = await testKeyboardNavigation(renderResult)
    expect(results.violations).toHaveLength(0)
    return results
  },

  /**
   * Assert that a component is screen reader compatible
   */
  async toBeScreenReaderCompatible(renderResult: RenderResult) {
    const results = await testScreenReaderCompatibility(renderResult)
    expect(results.violations).toHaveLength(0)
    return results
  }
}

/**
 * Common accessibility test patterns
 */
export const AccessibilityTestPatterns = {
  /**
   * Standard component accessibility test
   */
  async standardComponentTest(renderResult: RenderResult) {
    const [
      wcagResults,
      keyboardResults,
      screenReaderResults,
      contrastResults
    ] = await Promise.all([
      testWCAGCompliance(renderResult, 'AA'),
      testKeyboardNavigation(renderResult),
      testScreenReaderCompatibility(renderResult),
      testColorContrast(renderResult)
    ])

    return {
      wcag: wcagResults,
      keyboard: keyboardResults,
      screenReader: screenReaderResults,
      contrast: contrastResults,
      summary: generateAccessibilityReport([
        wcagResults,
        keyboardResults,
        screenReaderResults,
        contrastResults
      ])
    }
  },

  /**
   * Form component accessibility test
   */
  async formComponentTest(renderResult: RenderResult) {
    const [
      formResults,
      keyboardResults,
      screenReaderResults
    ] = await Promise.all([
      testFormAccessibility(renderResult),
      testKeyboardNavigation(renderResult),
      testScreenReaderCompatibility(renderResult)
    ])

    return {
      form: formResults,
      keyboard: keyboardResults,
      screenReader: screenReaderResults,
      summary: generateAccessibilityReport([
        formResults,
        keyboardResults,
        screenReaderResults
      ])
    }
  }
}