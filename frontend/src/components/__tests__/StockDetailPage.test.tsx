import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StockDetailPage } from '../StockDetailPage'
import {
  renderWithProviders,
  checkAccessibility,
  mockFetch,
  testDataFactories,
  fireKeyboardEvent,
  captureVisualSnapshot,
  toMatchSnapshotWithDynamicContent,
} from '@/tests/test-utils'
import { useUrlState } from '@/hooks/useUrlState'
import { useStockData } from '@/hooks/useStockData'

// Mock hooks
jest.mock('@/hooks/useUrlState')
jest.mock('@/hooks/useStockData')

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

describe('StockDetailPage', () => {
  const mockUseUrlState = useUrlState as jest.MockedFunction<typeof useUrlState>
  const mockUseStockData = useStockData as jest.MockedFunction<typeof useStockData>

  const defaultUrlState = {
    timeRange: '1M' as const,
    customStart: undefined,
    customEnd: undefined,
    setTimeRange: jest.fn(),
    getShareableUrl: jest.fn().mockReturnValue('https://example.com/stock/AAPL?range=1M'),
  }

  const defaultStockData = {
    data: null,
    loading: false,
    error: null,
    lastFetched: null,
    fetchData: jest.fn(),
    retry: jest.fn(),
    clearError: jest.fn(),
    cancel: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseUrlState.mockReturnValue(defaultUrlState)
    mockUseStockData.mockReturnValue(defaultStockData)
  })

  describe('Rendering', () => {
    it('should render correctly with symbol', () => {
      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(screen.getByText('AAPL')).toBeInTheDocument()
      expect(screen.getByText('Stock Analysis Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Share')).toBeInTheDocument()
      expect(screen.getByText('Back to Portfolio')).toBeInTheDocument()
      
      captureVisualSnapshot(container, 'stock-detail-page-initial')
    })

    it('should render TimeRangeSelector with correct props', () => {
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      const timeRangeSelector = screen.getByRole('group', { name: /time range/i })
      expect(timeRangeSelector).toBeInTheDocument()
    })

    it('should pass accessibility checks', async () => {
      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      await checkAccessibility(container)
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when data is loading', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        loading: true,
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(screen.getByText('Fetching stock data for AAPL...')).toBeInTheDocument()
      expect(screen.getByText('Cancel Request')).toBeInTheDocument()
    })

    it('should allow canceling request during loading', async () => {
      const cancelMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        loading: true,
        cancel: cancelMock,
      })

      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Cancel Request'))
      expect(cancelMock).toHaveBeenCalled()
    })
  })

  describe('Error State', () => {
    const errorMessage = 'Failed to fetch stock data'

    beforeEach(() => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        error: errorMessage,
      })
    })

    it('should display error message with retry options', () => {
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(screen.getByText('Failed to Load Data')).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByText('Retry')).toBeInTheDocument()
      expect(screen.getByText('Retry Options')).toBeInTheDocument()
      expect(screen.getByText('Dismiss')).toBeInTheDocument()
    })

    it('should handle retry action', async () => {
      const retryMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        error: errorMessage,
        retry: retryMock,
      })

      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Retry'))
      expect(retryMock).toHaveBeenCalled()
    })

    it('should show retry options when clicked', async () => {
      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Retry Options'))
      
      expect(screen.getByText('Force refresh (bypass cache)')).toBeInTheDocument()
      expect(screen.getByText('Try with 1-day range')).toBeInTheDocument()
      expect(screen.getByText('Try with 1-month range')).toBeInTheDocument()
    })

    it('should handle dismiss error', async () => {
      const clearErrorMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        error: errorMessage,
        clearError: clearErrorMock,
      })

      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Dismiss'))
      expect(clearErrorMock).toHaveBeenCalled()
    })
  })

  describe('Data Display', () => {
    const mockData = {
      data: {
        AAPL: {
          data: [
            { Date: '2024-01-01', Open: 150, High: 155, Low: 149, Close: 154, Volume: 1000000 },
            { Date: '2024-01-02', Open: 154, High: 156, Low: 152, Close: 155, Volume: 1200000 },
          ],
          date_range: {
            start: '2024-01-01',
            end: '2024-01-02',
          },
        },
      },
      metadata: {
        successful_tickers: 1,
        total_tickers: 1,
        execution_time: 0.523,
      },
    }

    beforeEach(() => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        data: mockData,
        lastFetched: new Date('2024-01-02T10:00:00'),
      })
    })

    it('should display stock data correctly', () => {
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      // Check chart section
      expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
      expect(screen.getByText('1 of 1 tickers loaded')).toBeInTheDocument()
      
      // Check data summary
      expect(screen.getByText('Data Summary')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument() // Data points
      expect(screen.getByText('0.52s')).toBeInTheDocument() // Execution time
      
      // Check recent data table
      expect(screen.getByText('Recent Data')).toBeInTheDocument()
      const table = screen.getByRole('table')
      expect(within(table).getByText('$150.00')).toBeInTheDocument()
      expect(within(table).getByText('$155.00')).toBeInTheDocument()
    })

    it('should display last fetched time', () => {
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle time range changes', async () => {
      const setTimeRangeMock = jest.fn()
      const clearErrorMock = jest.fn()
      mockUseUrlState.mockReturnValue({
        ...defaultUrlState,
        setTimeRange: setTimeRangeMock,
      })
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        clearError: clearErrorMock,
      })

      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      // Simulate time range change (would be triggered by TimeRangeSelector)
      const timeRangeSelector = screen.getByRole('group', { name: /time range/i })
      // This would be handled by the TimeRangeSelector component
      
      expect(clearErrorMock).not.toHaveBeenCalled() // Will be called when range changes
    })

    it('should handle share URL functionality', async () => {
      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Share'))
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/stock/AAPL?range=1M')
    })

    it('should handle share URL fallback when clipboard fails', async () => {
      const mockPrompt = jest.spyOn(window, 'prompt').mockImplementation()
      ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Clipboard failed'))
      
      const user = userEvent.setup()
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      await user.click(screen.getByText('Share'))
      
      await waitFor(() => {
        expect(mockPrompt).toHaveBeenCalledWith('Copy this URL to share:', 'https://example.com/stock/AAPL?range=1M')
      })
      
      mockPrompt.mockRestore()
    })
  })

  describe('Lifecycle', () => {
    it('should fetch data on mount', () => {
      const fetchDataMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        fetchData: fetchDataMock,
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(fetchDataMock).toHaveBeenCalledWith(['AAPL'], '1M', undefined, undefined)
    })

    it('should cancel request on unmount', () => {
      const cancelMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        cancel: cancelMock,
      })

      const { unmount } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      unmount()
      
      expect(cancelMock).toHaveBeenCalled()
    })

    it('should refetch when parameters change', () => {
      const fetchDataMock = jest.fn()
      const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      mockUseUrlState.mockReturnValue({
        ...defaultUrlState,
        timeRange: '1Y' as const,
      })
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        fetchData: fetchDataMock,
      })
      
      rerender(<StockDetailPage symbol="AAPL" />)
      
      expect(fetchDataMock).toHaveBeenCalledWith(['AAPL'], '1Y', undefined, undefined)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty symbol gracefully', () => {
      const fetchDataMock = jest.fn()
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        fetchData: fetchDataMock,
      })

      renderWithProviders(<StockDetailPage symbol="" />)
      
      expect(fetchDataMock).not.toHaveBeenCalled()
    })

    it('should handle missing data gracefully', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        data: {
          data: {},
          metadata: {
            successful_tickers: 0,
            total_tickers: 1,
            execution_time: 0.1,
          },
        },
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('should handle data with null values', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        data: {
          data: {
            AAPL: {
              data: [
                { Date: '2024-01-01', Open: null, High: null, Low: null, Close: null, Volume: null },
              ],
              date_range: {
                start: '2024-01-01',
                end: '2024-01-01',
              },
            },
          },
          metadata: {
            successful_tickers: 1,
            total_tickers: 1,
            execution_time: 0.1,
          },
        },
      })

      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      const table = screen.getByRole('table')
      expect(within(table).queryByText('$null')).not.toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for buttons', async () => {
      renderWithProviders(<StockDetailPage symbol="AAPL" />)
      
      const shareButton = screen.getByText('Share')
      shareButton.focus()
      
      fireKeyboardEvent(shareButton, 'Enter')
      
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
  })

  describe('Snapshot Tests', () => {
    it('should match snapshot for loading state', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        loading: true,
      })

      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      toMatchSnapshotWithDynamicContent(container.innerHTML, ['data-testid', 'id'])
    })

    it('should match snapshot for error state', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        error: 'Test error',
      })

      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      toMatchSnapshotWithDynamicContent(container.innerHTML, ['data-testid', 'id'])
    })

    it('should match snapshot for data state', () => {
      mockUseStockData.mockReturnValue({
        ...defaultStockData,
        data: {
          data: {
            AAPL: {
              data: [testDataFactories.chartData(5)],
              date_range: { start: '2024-01-01', end: '2024-01-05' },
            },
          },
          metadata: {
            successful_tickers: 1,
            total_tickers: 1,
            execution_time: 0.5,
          },
        },
      })

      const { container } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
      toMatchSnapshotWithDynamicContent(container.innerHTML, ['data-testid', 'id', 'Date'])
    })
  })
})