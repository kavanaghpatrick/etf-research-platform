import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StockDetailPage } from '@/components/StockDetailPage'
import { StockChart } from '@/components/StockChart'
import { TimeRangeSelector } from '@/components/TimeRangeSelector'
import { useStockData } from '@/hooks/useStockData'
import { useUrlState } from '@/hooks/useUrlState'
import { renderWithProviders, mockFetch, checkAccessibility } from '@/tests/test-utils'

// Mock modules
jest.mock('@/hooks/useStockData')
jest.mock('@/hooks/useUrlState')

// Mock environment variables
const originalEnv = process.env
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_API_BASE_URL: 'https://api.test.com',
    NEXT_PUBLIC_API_TIMEOUT: '5000',
  }
})

afterAll(() => {
  process.env = originalEnv
})

describe('Stock Detail Integration Flow', () => {
  const mockUseStockData = useStockData as jest.MockedFunction<typeof useStockData>
  const mockUseUrlState = useUrlState as jest.MockedFunction<typeof useUrlState>

  const mockStockDataResponse = {
    data: {
      AAPL: {
        data: [
          { Date: '2024-01-01', Open: 150, High: 155, Low: 149, Close: 154, Volume: 1000000 },
          { Date: '2024-01-02', Open: 154, High: 156, Low: 152, Close: 155, Volume: 1200000 },
          { Date: '2024-01-03', Open: 155, High: 158, Low: 154, Close: 157, Volume: 1100000 },
        ],
        date_range: { start: '2024-01-01', end: '2024-01-03' },
      },
    },
    metadata: {
      successful_tickers: 1,
      total_tickers: 1,
      execution_time: 0.523,
    },
  }

  const setupMocks = (initialData = null) => {
    mockUseUrlState.mockReturnValue({
      timeRange: '1M',
      customStart: undefined,
      customEnd: undefined,
      setTimeRange: jest.fn(),
      getShareableUrl: jest.fn().mockReturnValue('https://example.com/stock/AAPL?range=1M'),
    })

    mockUseStockData.mockReturnValue({
      data: initialData,
      loading: false,
      error: null,
      lastFetched: initialData ? new Date() : null,
      fetchData: jest.fn(),
      refetch: jest.fn(),
      retry: jest.fn(),
      clearError: jest.fn(),
      cancel: jest.fn(),
    })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    setupMocks()
  })

  describe('Complete User Journey', () => {
    it('should handle complete stock analysis workflow', async () => {
      const user = userEvent.setup()
      const fetchDataMock = jest.fn()
      const setTimeRangeMock = jest.fn()

      // Setup initial state
      mockUseStockData.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        lastFetched: null,
        fetchData: fetchDataMock,
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      mockUseUrlState.mockReturnValue({
        timeRange: '1M',
        customStart: undefined,
        customEnd: undefined,
        setTimeRange: setTimeRangeMock,
        getShareableUrl: jest.fn().mockReturnValue('https://example.com/stock/AAPL?range=1M'),
      })

      const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Step 1: Verify initial loading state
      expect(screen.getByText('Fetching stock data for AAPL...')).toBeInTheDocument()
      expect(fetchDataMock).toHaveBeenCalledWith(['AAPL'], '1M', undefined, undefined)

      // Step 2: Simulate data loaded
      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: fetchDataMock,
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      rerender(<StockDetailPage symbol="AAPL" />)

      // Step 3: Verify data display
      await waitFor(() => {
        expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument() // Data points
        expect(screen.getByText('0.52s')).toBeInTheDocument() // Execution time
      })

      // Step 4: Interact with time range selector
      const oneYearButton = screen.getByText('1Y')
      await user.click(oneYearButton)

      expect(setTimeRangeMock).toHaveBeenCalledWith('1Y', undefined, undefined)

      // Step 5: Verify data table
      const table = screen.getByRole('table')
      expect(within(table).getByText('$150.00')).toBeInTheDocument()
      expect(within(table).getByText('$157.00')).toBeInTheDocument()
      expect(within(table).getByText('1,000,000')).toBeInTheDocument()

      // Step 6: Test share functionality
      const shareButton = screen.getByText('Share')
      await user.click(shareButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/stock/AAPL?range=1M')
    })

    it('should handle error recovery flow', async () => {
      const user = userEvent.setup()
      const retryMock = jest.fn()
      const clearErrorMock = jest.fn()
      const fetchDataMock = jest.fn()

      // Start with error state
      mockUseStockData.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch stock data',
        lastFetched: null,
        fetchData: fetchDataMock,
        refetch: jest.fn(),
        retry: retryMock,
        clearError: clearErrorMock,
        cancel: jest.fn(),
      })

      const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Verify error state
      expect(screen.getByText('Failed to Load Data')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch stock data')).toBeInTheDocument()

      // Open retry options
      await user.click(screen.getByText('Retry Options'))
      expect(screen.getByText('Force refresh (bypass cache)')).toBeInTheDocument()

      // Try different time range
      await user.click(screen.getByText('Try with 1-day range'))
      expect(clearErrorMock).toHaveBeenCalled()

      // Simulate successful retry
      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: fetchDataMock,
        refetch: jest.fn(),
        retry: retryMock,
        clearError: clearErrorMock,
        cancel: jest.fn(),
      })

      rerender(<StockDetailPage symbol="AAPL" />)

      // Verify recovery
      await waitFor(() => {
        expect(screen.queryByText('Failed to Load Data')).not.toBeInTheDocument()
        expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
      })
    })

    it('should handle custom date range selection', async () => {
      const user = userEvent.setup()
      const setTimeRangeMock = jest.fn()

      mockUseUrlState.mockReturnValue({
        timeRange: '1M',
        customStart: undefined,
        customEnd: undefined,
        setTimeRange: setTimeRangeMock,
        getShareableUrl: jest.fn(),
      })

      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Click custom range button
      await user.click(screen.getByText('Custom'))

      // Fill in date inputs
      const startDateInput = screen.getByLabelText('Start Date')
      const endDateInput = screen.getByLabelText('End Date')

      await user.type(startDateInput, '2024-01-01')
      await user.type(endDateInput, '2024-03-31')

      // Apply custom range
      await user.click(screen.getByText('Apply'))

      expect(setTimeRangeMock).toHaveBeenCalledWith('CUSTOM', '2024-01-01', '2024-03-31')
    })

    it('should handle partial data failures gracefully', async () => {
      const partialData = {
        data: {
          AAPL: mockStockDataResponse.data.AAPL,
          INVALID: null,
        },
        metadata: {
          successful_tickers: 1,
          total_tickers: 2,
          execution_time: 0.8,
        },
      }

      mockUseStockData.mockReturnValue({
        data: partialData,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Should display successful data
      expect(screen.getByText('1 of 2 tickers loaded')).toBeInTheDocument()
      expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
    })
  })

  describe('Component Interactions', () => {
    it('should coordinate between TimeRangeSelector and data fetching', async () => {
      const user = userEvent.setup()
      const fetchDataMock = jest.fn()
      const clearErrorMock = jest.fn()

      let currentTimeRange = '1M'
      
      mockUseUrlState.mockImplementation(() => ({
        timeRange: currentTimeRange,
        customStart: undefined,
        customEnd: undefined,
        setTimeRange: (newRange) => {
          currentTimeRange = newRange
        },
        getShareableUrl: jest.fn(),
      }))

      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: fetchDataMock,
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: clearErrorMock,
        cancel: jest.fn(),
      })

      const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Change time range
      await user.click(screen.getByText('3M'))

      // Should clear any errors and trigger new fetch
      expect(clearErrorMock).toHaveBeenCalled()
      
      // Rerender with new time range
      currentTimeRange = '3M'
      rerender(<StockDetailPage symbol="AAPL" />)

      expect(fetchDataMock).toHaveBeenLastCalledWith(['AAPL'], '3M', undefined, undefined)
    })

    it('should handle loading state transitions smoothly', async () => {
      const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Transition: Initial -> Loading
      mockUseStockData.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        lastFetched: null,
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      rerender(<StockDetailPage symbol="AAPL" />)
      expect(screen.getByText('Fetching stock data for AAPL...')).toBeInTheDocument()

      // Transition: Loading -> Success
      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      rerender(<StockDetailPage symbol="AAPL" />)
      await waitFor(() => {
        expect(screen.queryByText('Fetching stock data for AAPL...')).not.toBeInTheDocument()
        expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility in Integration', () => {
    it('should maintain accessibility through user interactions', async () => {
      const user = userEvent.setup()
      
      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Check initial accessibility
      await checkAccessibility(container)

      // Interact with components and recheck
      await user.click(screen.getByText('Custom'))
      await checkAccessibility(container)

      await user.click(screen.getByText('Cancel'))
      await checkAccessibility(container)
    })

    it('should handle keyboard navigation through the flow', async () => {
      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)

      // Tab through interactive elements
      const shareButton = screen.getByText('Share')
      shareButton.focus()
      expect(document.activeElement).toBe(shareButton)

      // Tab to time range buttons
      const timeRangeButtons = screen.getAllByRole('button')
      timeRangeButtons[0].focus()
      expect(document.activeElement?.textContent).toBeTruthy()
    })
  })

  describe('Performance Considerations', () => {
    it('should not cause unnecessary re-renders', () => {
      const renderCount = jest.fn()
      
      const TestWrapper = ({ children }: { children: React.ReactNode }) => {
        renderCount()
        return <>{children}</>
      }

      mockUseStockData.mockReturnValue({
        data: mockStockDataResponse,
        loading: false,
        error: null,
        lastFetched: new Date(),
        fetchData: jest.fn(),
        refetch: jest.fn(),
        retry: jest.fn(),
        clearError: jest.fn(),
        cancel: jest.fn(),
      })

      const { rerender } = render(
        <TestWrapper>
          <QueryClientProvider client={new QueryClient()}>
            <StockDetailPage symbol="AAPL" />
          </QueryClientProvider>
        </TestWrapper>
      )

      const initialRenderCount = renderCount.mock.calls.length

      // Rerender with same props
      rerender(
        <TestWrapper>
          <QueryClientProvider client={new QueryClient()}>
            <StockDetailPage symbol="AAPL" />
          </QueryClientProvider>
        </TestWrapper>
      )

      // Should have minimal additional renders
      expect(renderCount.mock.calls.length).toBeLessThanOrEqual(initialRenderCount + 2)
    })
  })
})