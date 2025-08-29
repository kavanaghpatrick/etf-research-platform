import { ComponentType } from 'react'
import { render, RenderResult } from '@testing-library/react'
import { axe } from 'jest-axe'

// Component test suite builder
export interface ComponentTestConfig<P = any> {
  component: ComponentType<P>
  defaultProps: P
  testCases?: Array<{
    name: string
    props: Partial<P>
    expectedBehavior?: (result: RenderResult) => void | Promise<void>
  }>
  accessibilityChecks?: boolean
  performanceThreshold?: number
  snapshotTests?: boolean
}

export function createComponentTestSuite<P>(config: ComponentTestConfig<P>) {
  const {
    component: Component,
    defaultProps,
    testCases = [],
    accessibilityChecks = true,
    performanceThreshold,
    snapshotTests = true,
  } = config

  describe(`${Component.displayName || Component.name} Component`, () => {
    // Default render test
    it('renders without crashing', () => {
      const { container } = render(<Component {...defaultProps} />)
      expect(container).toBeInTheDocument()
    })

    // Snapshot test
    if (snapshotTests) {
      it('matches snapshot', () => {
        const { container } = render(<Component {...defaultProps} />)
        expect(container.firstChild).toMatchSnapshot()
      })
    }

    // Accessibility test
    if (accessibilityChecks) {
      it('has no accessibility violations', async () => {
        const { container } = render(<Component {...defaultProps} />)
        const results = await axe(container)
        expect(results).toHaveNoViolations()
      })
    }

    // Performance test
    if (performanceThreshold) {
      it(`renders within ${performanceThreshold}ms`, () => {
        const start = performance.now()
        render(<Component {...defaultProps} />)
        const end = performance.now()
        expect(end - start).toBeLessThan(performanceThreshold)
      })
    }

    // Custom test cases
    testCases.forEach(({ name, props, expectedBehavior }) => {
      it(name, async () => {
        const result = render(
          <Component {...defaultProps} {...props} />
        )
        if (expectedBehavior) {
          await expectedBehavior(result)
        }
      })
    })
  })
}

// Props combination testing
export function testPropsCombinations<P>(
  Component: ComponentType<P>,
  propsCombinations: Array<Partial<P>>,
  baseProps: P
) {
  propsCombinations.forEach((props, index) => {
    it(`renders correctly with props combination ${index + 1}`, () => {
      const { container } = render(
        <Component {...baseProps} {...props} />
      )
      expect(container).toBeInTheDocument()
      expect(container.firstChild).toMatchSnapshot(`props-combination-${index + 1}`)
    })
  })
}

// Error boundary testing
export function testErrorBoundary(
  Component: ComponentType<any>,
  errorProps: any,
  expectedError: string | RegExp
) {
  // Mock console.error to prevent noise in test output
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })

  afterAll(() => {
    console.error = originalError
  })

  it('handles errors gracefully', () => {
    expect(() => {
      render(<Component {...errorProps} />)
    }).toThrow(expectedError)
  })
}

// Responsive testing
export function testResponsiveness(
  Component: ComponentType<any>,
  props: any,
  viewports: Array<{ width: number; height: number; name: string }>
) {
  viewports.forEach(({ width, height, name }) => {
    it(`renders correctly on ${name} (${width}x${height})`, () => {
      // Mock window dimensions
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
      })
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height,
      })

      const { container } = render(<Component {...props} />)
      expect(container.firstChild).toMatchSnapshot(`responsive-${name}`)
    })
  })
}

// Animation testing
export function testAnimations(
  Component: ComponentType<any>,
  props: any,
  animationStates: Array<{ name: string; trigger: () => void; duration: number }>
) {
  animationStates.forEach(({ name, trigger, duration }) => {
    it(`handles ${name} animation correctly`, async () => {
      jest.useFakeTimers()
      
      const { container } = render(<Component {...props} />)
      const beforeSnapshot = container.innerHTML
      
      trigger()
      jest.advanceTimersByTime(duration / 2)
      
      const midSnapshot = container.innerHTML
      expect(midSnapshot).not.toBe(beforeSnapshot)
      
      jest.advanceTimersByTime(duration / 2)
      
      const afterSnapshot = container.innerHTML
      expect(afterSnapshot).toMatchSnapshot(`animation-${name}-complete`)
      
      jest.useRealTimers()
    })
  })
}

// Theme testing
export function testThemeVariants(
  Component: ComponentType<any>,
  props: any,
  themes: Array<{ name: string; className?: string; cssVariables?: Record<string, string> }>
) {
  themes.forEach(({ name, className, cssVariables }) => {
    it(`renders correctly with ${name} theme`, () => {
      // Apply theme
      if (className) {
        document.body.className = className
      }
      if (cssVariables) {
        Object.entries(cssVariables).forEach(([key, value]) => {
          document.documentElement.style.setProperty(key, value)
        })
      }

      const { container } = render(<Component {...props} />)
      expect(container.firstChild).toMatchSnapshot(`theme-${name}`)

      // Cleanup
      document.body.className = ''
      if (cssVariables) {
        Object.keys(cssVariables).forEach(key => {
          document.documentElement.style.removeProperty(key)
        })
      }
    })
  })
}

// Data fetching testing
export function testDataFetching(
  Component: ComponentType<any>,
  props: any,
  scenarios: Array<{
    name: string
    mockData?: any
    mockError?: Error
    expectedLoadingState?: boolean
    expectedErrorState?: boolean
  }>
) {
  scenarios.forEach(({ name, mockData, mockError, expectedLoadingState, expectedErrorState }) => {
    it(`handles ${name} scenario correctly`, async () => {
      // Mock fetch based on scenario
      if (mockError) {
        global.fetch = jest.fn().mockRejectedValue(mockError)
      } else {
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: async () => mockData,
        })
      }

      const { container, findByTestId } = render(<Component {...props} />)

      if (expectedLoadingState) {
        expect(await findByTestId('loading-spinner')).toBeInTheDocument()
      }

      if (expectedErrorState) {
        expect(await findByTestId('error-message')).toBeInTheDocument()
      }

      if (mockData && !expectedErrorState) {
        expect(container).toMatchSnapshot(`data-${name}`)
      }
    })
  })
}