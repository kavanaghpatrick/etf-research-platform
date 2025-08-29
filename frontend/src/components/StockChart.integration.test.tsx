import React from 'react'
import { StockChart } from './StockChart'
import { renderWithProviders, screen, waitFor } from '@test-utils'
import { 
  server, 
  setupAPITests, 
  apiEndpoints, 
  mockResponses, 
  createHandlers,
  apiScenarios,
  RequestInterceptor 
} from '@test-utils/api-test-utils'

// Setup API mocking
setupAPITests()

describe('StockChart Integration Tests', () => {
  const requestInterceptor = new RequestInterceptor()

  beforeEach(() => {
    requestInterceptor.clear()
  })

  describe('API Integration', () => {
    it('fetches and displays chart data correctly', async () => {
      const mockData = mockResponses.chartData(50)
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData 
        />
      )

      // Should show loading state initially
      expect(screen.getByTestId('chart-loading')).toBeInTheDocument()

      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId('chart-loading')).not.toBeInTheDocument()
      })

      // Verify chart is rendered with data
      expect(screen.getByRole('img', { name: /stock price chart/i })).toBeInTheDocument()
      expect(screen.getByTestId('data-point-count')).toHaveTextContent('50')

      // Verify API was called correctly
      requestInterceptor.expectRequest(apiEndpoints.chart('AAPL', '1D'))
    })

    it('handles API errors gracefully', async () => {
      apiScenarios.error(apiEndpoints.chart('AAPL', '1D'), 500, 'Server Error')

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData 
        />
      )

      await waitFor(() => {
        expect(screen.getByText(/Failed to load chart data/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })
    })

    it('implements retry logic for failed requests', async () => {
      let attempts = 0
      server.use(
        rest.get(apiEndpoints.chart('AAPL', '1D'), (req, res, ctx) => {
          attempts++
          if (attempts < 3) {
            return res(ctx.status(500), ctx.json({ error: 'Server Error' }))
          }
          return res(ctx.json(mockResponses.chartData(50)))
        })
      )

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData 
          retryOnError 
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('img', { name: /stock price chart/i })).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(attempts).toBe(3)
    })

    it('cancels requests when component unmounts', async () => {
      apiScenarios.loading(apiEndpoints.chart('AAPL', '1D'), 2000)

      const { unmount } = renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData 
        />
      )

      // Unmount while request is pending
      unmount()

      // Wait to ensure no state updates occur after unmount
      await waitFor(() => {
        expect(requestInterceptor.getRequests()).toHaveLength(1)
      })

      // No errors should be thrown
    })
  })

  describe('Real-time Updates', () => {
    it('subscribes to real-time price updates', async () => {
      const mockData = mockResponses.chartData(50)
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData
          enableRealTime 
        />
      )

      await waitFor(() => {
        expect(screen.getByTestId('real-time-indicator')).toBeInTheDocument()
      })

      // Simulate WebSocket message
      const ws = screen.getByTestId('websocket-connection') as any
      ws.onmessage({
        data: JSON.stringify({
          type: 'price_update',
          symbol: 'AAPL',
          price: 151.25,
          timestamp: new Date().toISOString(),
        })
      })

      await waitFor(() => {
        expect(screen.getByTestId('latest-price')).toHaveTextContent('151.25')
      })
    })

    it('handles WebSocket disconnections', async () => {
      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          enableRealTime 
        />
      )

      const ws = screen.getByTestId('websocket-connection') as any
      
      // Simulate disconnect
      ws.onclose({ code: 1006, reason: 'Connection lost' })

      await waitFor(() => {
        expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument()
      })

      // Simulate reconnect
      ws.onopen()

      await waitFor(() => {
        expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Data Synchronization', () => {
    it('synchronizes with other chart components', async () => {
      const mockData = mockResponses.chartData(100)
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      const onDataSync = jest.fn()

      renderWithProviders(
        <>
          <StockChart 
            symbol="AAPL" 
            timeRange="1D" 
            height={400} 
            fetchData
            syncGroup="main"
            onDataSync={onDataSync}
          />
          <StockChart 
            symbol="AAPL" 
            timeRange="1D" 
            height={200} 
            syncGroup="main"
            useSyncedData
          />
        </>
      )

      await waitFor(() => {
        expect(onDataSync).toHaveBeenCalledWith({
          symbol: 'AAPL',
          timeRange: '1D',
          data: expect.any(Array),
        })
      })

      // Both charts should display the same data
      const charts = screen.getAllByRole('img', { name: /stock price chart/i })
      expect(charts).toHaveLength(2)
    })
  })

  describe('Performance Monitoring', () => {
    it('reports performance metrics', async () => {
      const onPerformanceReport = jest.fn()
      const mockData = mockResponses.chartData(1000)
      
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData
          onPerformanceReport={onPerformanceReport}
        />
      )

      await waitFor(() => {
        expect(onPerformanceReport).toHaveBeenCalledWith(
          expect.objectContaining({
            renderTime: expect.any(Number),
            dataFetchTime: expect.any(Number),
            totalTime: expect.any(Number),
            dataPoints: 1000,
          })
        )
      })

      const report = onPerformanceReport.mock.calls[0][0]
      expect(report.renderTime).toBeLessThan(100)
      expect(report.dataFetchTime).toBeLessThan(1000)
    })
  })

  describe('Cache Integration', () => {
    it('uses cached data when available', async () => {
      const mockData = mockResponses.chartData(50)
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      // First render - should fetch from API
      const { unmount } = renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData
          enableCache 
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })

      expect(requestInterceptor.getRequests()).toHaveLength(1)

      unmount()
      requestInterceptor.clear()

      // Second render - should use cache
      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData
          enableCache 
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })

      // No new API request should be made
      expect(requestInterceptor.getRequests()).toHaveLength(0)
      expect(screen.getByTestId('data-source')).toHaveTextContent('cached')
    })

    it('invalidates cache on refresh', async () => {
      const mockData = mockResponses.chartData(50)
      server.use(
        createHandlers.chart('AAPL', '1D', mockData)
      )

      renderWithProviders(
        <StockChart 
          symbol="AAPL" 
          timeRange="1D" 
          height={400} 
          fetchData
          enableCache 
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('img')).toBeInTheDocument()
      })

      requestInterceptor.clear()

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await userEvent.click(refreshButton)

      await waitFor(() => {
        expect(requestInterceptor.getRequests()).toHaveLength(1)
      })
    })
  })
})