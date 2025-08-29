import React from 'react'
import { StockChart } from './StockChart'
import { 
  renderWithProviders, 
  checkAccessibility, 
  mockFetch,
  testDataFactories,
  fireKeyboardEvent,
  screen,
  waitFor,
  userEvent
} from '@test-utils'
import { createComponentTestSuite } from '@test-utils/component-test-utils'

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

describe('StockChart Component', () => {
  const defaultProps = {
    data: testDataFactories.chartData(50),
    timeRange: '1D' as const,
    height: 400,
  }

  // Use the component test suite builder for standard tests
  createComponentTestSuite({
    component: StockChart,
    defaultProps,
    accessibilityChecks: true,
    performanceThreshold: 100,
    snapshotTests: true,
    testCases: [
      {
        name: 'renders with loading state',
        props: { data: [], isLoading: true },
        expectedBehavior: async ({ getByTestId }) => {
          expect(getByTestId('chart-loading')).toBeInTheDocument()
        },
      },
      {
        name: 'renders with error state',
        props: { data: [], error: 'Failed to load data' },
        expectedBehavior: async ({ getByText }) => {
          expect(getByText(/Failed to load data/i)).toBeInTheDocument()
        },
      },
      {
        name: 'renders with different time ranges',
        props: { timeRange: '1M' as const },
        expectedBehavior: async ({ container }) => {
          expect(container.querySelector('[data-time-range="1M"]')).toBeInTheDocument()
        },
      },
    ],
  })

  // Custom accessibility tests
  describe('Accessibility', () => {
    it('provides proper ARIA labels and descriptions', () => {
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      
      const chart = container.querySelector('[role="img"]')
      expect(chart).toHaveAttribute('aria-label')
      expect(chart).toHaveAttribute('aria-describedby')
    })

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      
      const chart = container.querySelector('[role="img"]')!
      
      // Focus the chart
      await user.tab()
      expect(chart).toHaveFocus()
      
      // Navigate with arrow keys
      fireKeyboardEvent(chart as HTMLElement, 'ArrowRight')
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      })
    })

    it('announces data changes to screen readers', async () => {
      const { rerender } = renderWithProviders(<StockChart {...defaultProps} />)
      
      const newData = testDataFactories.chartData(60)
      rerender(<StockChart {...defaultProps} data={newData} />)
      
      await waitFor(() => {
        const liveRegion = screen.getByRole('status')
        expect(liveRegion).toHaveTextContent(/Chart data updated/i)
      })
    })

    it('provides text alternatives for visual information', () => {
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      
      // Check for accessible table or description
      const description = container.querySelector('[id*="chart-description"]')
      expect(description).toBeInTheDocument()
      expect(description).toHaveTextContent(/price data/i)
    })

    it('maintains sufficient color contrast', async () => {
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      await checkAccessibility(container)
    })
  })

  // Interaction tests
  describe('User Interactions', () => {
    it('shows tooltip on hover', async () => {
      const user = userEvent.setup()
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      
      const chartArea = container.querySelector('.chart-area')!
      await user.hover(chartArea)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
      })
    })

    it('allows zooming with mouse wheel', async () => {
      const onZoom = jest.fn()
      const { container } = renderWithProviders(
        <StockChart {...defaultProps} onZoom={onZoom} />
      )
      
      const chartArea = container.querySelector('.chart-area')!
      
      // Simulate mouse wheel event
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        bubbles: true,
      })
      chartArea.dispatchEvent(wheelEvent)
      
      expect(onZoom).toHaveBeenCalled()
    })

    it('supports pan gesture on touch devices', async () => {
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      const chartArea = container.querySelector('.chart-area')!
      
      // Simulate touch events
      const touchStart = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as any],
        bubbles: true,
      })
      const touchMove = new TouchEvent('touchmove', {
        touches: [{ clientX: 200, clientY: 100 } as any],
        bubbles: true,
      })
      const touchEnd = new TouchEvent('touchend', { bubbles: true })
      
      chartArea.dispatchEvent(touchStart)
      chartArea.dispatchEvent(touchMove)
      chartArea.dispatchEvent(touchEnd)
      
      // Assert pan behavior
      await waitFor(() => {
        const viewport = container.querySelector('[data-viewport]')
        expect(viewport).toHaveAttribute('data-panned', 'true')
      })
    })
  })

  // Data handling tests
  describe('Data Handling', () => {
    it('handles empty data gracefully', () => {
      const { getByText } = renderWithProviders(
        <StockChart {...defaultProps} data={[]} />
      )
      expect(getByText(/No data available/i)).toBeInTheDocument()
    })

    it('handles data updates efficiently', async () => {
      const { rerender } = renderWithProviders(<StockChart {...defaultProps} />)
      
      // Update with new data
      const newData = testDataFactories.chartData(100)
      rerender(<StockChart {...defaultProps} data={newData} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('data-point-count')).toHaveTextContent('100')
      })
    })

    it('validates data format', () => {
      const invalidData = [{ x: 'invalid', y: 'invalid' }] as any
      
      // Should handle invalid data without crashing
      const { getByText } = renderWithProviders(
        <StockChart {...defaultProps} data={invalidData} />
      )
      expect(getByText(/Invalid data format/i)).toBeInTheDocument()
    })
  })

  // Responsive design tests
  describe('Responsive Behavior', () => {
    it('adapts to container size changes', async () => {
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      
      // Trigger resize observer callback
      const resizeCallback = (global.ResizeObserver as jest.Mock).mock.calls[0][0]
      resizeCallback([
        {
          contentRect: { width: 300, height: 200 },
          target: container.firstChild,
        },
      ])
      
      await waitFor(() => {
        const chart = container.querySelector('[data-chart-width="300"]')
        expect(chart).toBeInTheDocument()
      })
    })

    it('shows simplified view on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })
      
      const { container } = renderWithProviders(<StockChart {...defaultProps} />)
      expect(container.querySelector('[data-mobile-view="true"]')).toBeInTheDocument()
    })
  })

  // Error boundary tests
  describe('Error Handling', () => {
    it('catches and displays render errors', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }
      
      // Mock console.error to prevent noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      const { getByText } = renderWithProviders(
        <StockChart {...defaultProps}>
          <ThrowError />
        </StockChart>
      )
      
      expect(getByText(/Something went wrong/i)).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('recovers from API errors', async () => {
      mockFetch(null, { ok: false, status: 500 })
      
      const { getByText, rerender } = renderWithProviders(
        <StockChart {...defaultProps} fetchData />
      )
      
      await waitFor(() => {
        expect(getByText(/Failed to load chart data/i)).toBeInTheDocument()
      })
      
      // Retry with successful response
      mockFetch(testDataFactories.chartData(50))
      rerender(<StockChart {...defaultProps} fetchData retry />)
      
      await waitFor(() => {
        expect(screen.queryByText(/Failed to load/i)).not.toBeInTheDocument()
      })
    })
  })
})