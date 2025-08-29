import { renderHook, waitFor, act } from '@testing-library/react'
import { useStockData } from '../useStockData'
import { apiRequest, cleanupRequest } from '@/utils/api'
import { calculateStartDate, calculateEndDate } from '@/utils/timeRange'

// Mock dependencies
jest.mock('@/utils/api')
jest.mock('@/utils/timeRange')

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>
const mockCleanupRequest = cleanupRequest as jest.MockedFunction<typeof cleanupRequest>
const mockCalculateStartDate = calculateStartDate as jest.MockedFunction<typeof calculateStartDate>
const mockCalculateEndDate = calculateEndDate as jest.MockedFunction<typeof calculateEndDate>

// Mock console methods
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('useStockData', () => {
  const mockStockData = {
    data: {
      AAPL: {
        data: [
          { Date: '2024-01-01', Open: 150, High: 155, Low: 149, Close: 154, Volume: 1000000 },
          { Date: '2024-01-02', Open: 154, High: 156, Low: 152, Close: 155, Volume: 1200000 },
        ],
        date_range: { start: '2024-01-01', end: '2024-01-02' },
      },
    },
    metadata: {
      successful_tickers: 1,
      total_tickers: 1,
      execution_time: 0.523,
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCalculateStartDate.mockReturnValue('2024-01-01')
    mockCalculateEndDate.mockReturnValue('2024-01-31')
  })

  describe('Initial State', () => {
    it('should return initial state', () => {
      const { result } = renderHook(() => useStockData())

      expect(result.current.data).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.lastFetched).toBeNull()
    })
  })

  describe('fetchData', () => {
    it('should fetch data successfully', async () => {
      mockApiRequest.mockResolvedValueOnce(mockStockData)

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockStockData)
      expect(result.current.error).toBeNull()
      expect(result.current.lastFetched).toBeInstanceOf(Date)
    })

    it('should handle empty tickers array', async () => {
      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData([], '1M')
      })

      expect(result.current.error).toBe('Please provide at least one ticker symbol')
      expect(result.current.loading).toBe(false)
      expect(mockApiRequest).not.toHaveBeenCalled()
    })

    it('should use cache for duplicate requests', async () => {
      mockApiRequest.mockResolvedValueOnce(mockStockData)

      const { result } = renderHook(() => useStockData())

      // First request
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockApiRequest).toHaveBeenCalledTimes(1)

      // Second request with same parameters
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      // Should use cached data
      expect(mockApiRequest).toHaveBeenCalledTimes(1)
      expect(result.current.data).toEqual(mockStockData)
    })

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'Network error'
      mockApiRequest.mockRejectedValueOnce(new Error(errorMessage))

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain(errorMessage)
      expect(result.current.data).toBeNull()
      expect(console.error).toHaveBeenCalledWith(
        'Stock data fetch error:',
        expect.objectContaining({
          tickers: ['AAPL'],
          message: expect.stringContaining(errorMessage),
        })
      )
    })

    it('should handle custom date ranges', async () => {
      mockApiRequest.mockResolvedValueOnce(mockStockData)
      mockCalculateStartDate.mockReturnValue('2024-01-01')
      mockCalculateEndDate.mockReturnValue('2024-12-31')

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL'], 'CUSTOM', '2024-01-01', '2024-12-31')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockCalculateStartDate).toHaveBeenCalledWith('CUSTOM', '2024-01-01')
      expect(mockCalculateEndDate).toHaveBeenCalledWith('CUSTOM', '2024-12-31')
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"start_date":"2024-01-01"'),
        })
      )
    })

    it('should debounce rapid fetch calls', async () => {
      mockApiRequest.mockResolvedValue(mockStockData)

      const { result } = renderHook(() => useStockData())

      // Rapid calls
      act(() => {
        result.current.fetchData(['AAPL'], '1M')
        result.current.fetchData(['AAPL'], '1M')
        result.current.fetchData(['AAPL'], '1M')
      })

      // Wait for debounce
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      }, { timeout: 500 })

      // Should only call API once due to debouncing
      expect(mockApiRequest).toHaveBeenCalledTimes(1)
    })
  })

  describe('retry', () => {
    it('should retry last request', async () => {
      mockApiRequest
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(mockStockData)

      const { result } = renderHook(() => useStockData())

      // First request fails
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      // Retry
      await act(async () => {
        await result.current.retry()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockStockData)
      expect(result.current.error).toBeNull()
    })

    it('should handle retry without previous request', async () => {
      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.retry()
      })

      expect(result.current.error).toBe('No previous request to retry')
    })
  })

  describe('cancel', () => {
    it('should cancel ongoing request', async () => {
      mockApiRequest.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() => useStockData())

      act(() => {
        result.current.fetchData(['AAPL'], '1M')
      })

      expect(result.current.loading).toBe(true)

      act(() => {
        result.current.cancel()
      })

      expect(result.current.loading).toBe(false)
      expect(mockCleanupRequest).toHaveBeenCalled()
    })
  })

  describe('clearError', () => {
    it('should clear error state', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Test error'))

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('refetch', () => {
    it('should refetch with force refresh', async () => {
      mockApiRequest.mockResolvedValue(mockStockData)

      const { result } = renderHook(() => useStockData())

      // Initial fetch
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockApiRequest).toHaveBeenCalledTimes(1)

      // Refetch should bypass cache
      await act(async () => {
        await result.current.refetch()
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should make another API call
      expect(mockApiRequest).toHaveBeenCalledTimes(2)
    })

    it('should handle refetch without previous request', async () => {
      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.refetch()
      })

      expect(mockApiRequest).not.toHaveBeenCalled()
    })
  })

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = renderHook(() => useStockData())

      unmount()

      expect(mockCleanupRequest).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('should handle network timeout', async () => {
      mockApiRequest.mockRejectedValueOnce(new Error('Request timeout'))

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL', 'GOOGL', 'MSFT'], '1Y')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain('timeout')
    })

    it('should handle malformed API response', async () => {
      mockApiRequest.mockResolvedValueOnce({}) // Invalid response

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should handle gracefully even with malformed data
      expect(result.current.data).toEqual({})
    })

    it('should handle multiple tickers', async () => {
      const multiTickerData = {
        ...mockStockData,
        data: {
          AAPL: mockStockData.data.AAPL,
          GOOGL: { ...mockStockData.data.AAPL },
          MSFT: { ...mockStockData.data.AAPL },
        },
        metadata: {
          successful_tickers: 3,
          total_tickers: 3,
          execution_time: 1.5,
        },
      }

      mockApiRequest.mockResolvedValueOnce(multiTickerData)

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL', 'GOOGL', 'MSFT'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(multiTickerData)
      expect(result.current.data?.metadata.successful_tickers).toBe(3)
    })

    it('should handle partial failures', async () => {
      const partialData = {
        ...mockStockData,
        metadata: {
          successful_tickers: 1,
          total_tickers: 3,
          execution_time: 0.8,
        },
      }

      mockApiRequest.mockResolvedValueOnce(partialData)

      const { result } = renderHook(() => useStockData())

      await act(async () => {
        await result.current.fetchData(['AAPL', 'INVALID1', 'INVALID2'], '1M')
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(partialData)
      expect(result.current.error).toBeNull() // Should not error on partial success
    })
  })

  describe('Performance', () => {
    it('should cache multiple different requests', async () => {
      mockApiRequest.mockResolvedValue(mockStockData)

      const { result } = renderHook(() => useStockData())

      // Different requests
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      await act(async () => {
        await result.current.fetchData(['GOOGL'], '1M')
      })

      await act(async () => {
        await result.current.fetchData(['AAPL'], '1Y')
      })

      expect(mockApiRequest).toHaveBeenCalledTimes(3)

      // Repeat requests should use cache
      await act(async () => {
        await result.current.fetchData(['AAPL'], '1M')
      })

      expect(mockApiRequest).toHaveBeenCalledTimes(3) // No additional call
    })
  })
})