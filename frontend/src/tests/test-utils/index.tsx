import React, { ReactElement, ReactNode } from 'react'
import { render, RenderOptions, RenderResult } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { axe, toHaveNoViolations } from 'jest-axe'
import { act } from 'react'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient
  initialRouterState?: {
    pathname?: string
    query?: Record<string, string | string[] | undefined>
    asPath?: string
  }
}

// Create a custom render function that wraps components with providers
export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    }),
    initialRouterState = {},
    ...renderOptions
  }: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }

  const result = render(ui, { wrapper: Wrapper, ...renderOptions })
  
  return {
    ...result,
    queryClient,
  }
}

// Accessibility testing helper
export async function checkAccessibility(container: HTMLElement) {
  const results = await axe(container)
  expect(results).toHaveNoViolations()
  return results
}

// Wait for async updates
export async function waitForUpdates() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
  })
}

// Mock fetch helper
export function mockFetch(data: any, options: { status?: number; ok?: boolean } = {}) {
  const { status = 200, ok = true } = options
  
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  })
  
  return global.fetch as jest.Mock
}

// Performance testing helper
export function measurePerformance(callback: () => void): PerformanceEntry {
  const mark = `test-${Date.now()}`
  performance.mark(`${mark}-start`)
  callback()
  performance.mark(`${mark}-end`)
  performance.measure(mark, `${mark}-start`, `${mark}-end`)
  
  const measures = performance.getEntriesByName(mark)
  performance.clearMarks()
  performance.clearMeasures()
  
  return measures[0]
}

// Snapshot testing helper with dynamic content filtering
export function toMatchSnapshotWithDynamicContent(
  received: any,
  propertiesToIgnore: string[] = []
) {
  const filtered = JSON.parse(
    JSON.stringify(received, (key, value) => {
      if (propertiesToIgnore.includes(key)) {
        return '[DYNAMIC]'
      }
      if (typeof value === 'function') {
        return '[FUNCTION]'
      }
      return value
    })
  )
  
  expect(filtered).toMatchSnapshot()
}

// Mock component helper
export function createMockComponent(name: string) {
  return ({ children, ...props }: any) => (
    <div data-testid={`mock-${name}`} {...props}>
      {children}
    </div>
  )
}

// Test data factories
export const testDataFactories = {
  stock: (overrides = {}) => ({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150.25,
    change: 2.50,
    changePercent: 1.69,
    volume: 50000000,
    marketCap: 2500000000000,
    ...overrides,
  }),
  
  dividend: (overrides = {}) => ({
    exDate: '2024-02-09',
    paymentDate: '2024-02-15',
    amount: 0.24,
    yield: 0.5,
    ...overrides,
  }),
  
  chartData: (points = 100) => {
    const data = []
    const basePrice = 100
    const now = Date.now()
    
    for (let i = 0; i < points; i++) {
      data.push({
        x: new Date(now - (points - i) * 86400000).toISOString(),
        y: basePrice + Math.random() * 20 - 10,
      })
    }
    
    return data
  },
}

// Keyboard event helper
export function fireKeyboardEvent(
  element: HTMLElement,
  key: string,
  eventType: 'keydown' | 'keyup' | 'keypress' = 'keydown'
) {
  const event = new KeyboardEvent(eventType, {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  })
  
  element.dispatchEvent(event)
}

// Screen reader announcement helper
export function expectScreenReaderAnnouncement(text: string) {
  const liveRegions = document.querySelectorAll('[aria-live]')
  const announcements = Array.from(liveRegions)
    .map(region => region.textContent)
    .filter(Boolean)
  
  expect(announcements).toContain(text)
}

// Visual regression testing helper
export async function captureVisualSnapshot(
  element: HTMLElement,
  name: string
) {
  // This would integrate with a visual regression testing service
  // For now, we'll just capture the HTML structure
  const snapshot = element.innerHTML
    .replace(/id="[^"]*"/g, 'id="[ID]"')
    .replace(/data-testid="[^"]*"/g, 'data-testid="[TESTID]"')
    .replace(/\s+/g, ' ')
    .trim()
  
  expect(snapshot).toMatchSnapshot(`visual-${name}`)
}

// Export everything
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'