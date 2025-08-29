'use client'

import { useEffect, useState } from 'react'
import { TimeRangeSelector } from './TimeRangeSelector'
import { LoadingSpinner } from './LoadingSpinner'
import { useStockData } from '@/hooks/useStockData'
import { useUrlState } from '@/hooks/useUrlState'
import { TimeRange } from '@/types/stock'

interface StockDetailPageProps {
  symbol: string
}

export function StockDetailPage({ symbol }: StockDetailPageProps) {
  const {
    timeRange,
    customStart,
    customEnd,
    setTimeRange,
    getShareableUrl
  } = useUrlState(symbol)
  
  const {
    data,
    loading,
    error,
    lastFetched,
    fetchData,
    retry,
    clearError,
    cancel
  } = useStockData()

  const [showRetryOptions, setShowRetryOptions] = useState(false)

  // Fetch data when component mounts or parameters change
  useEffect(() => {
    if (symbol) {
      fetchData([symbol], timeRange, customStart, customEnd)
    }
    
    // Cleanup function to cancel requests on unmount
    return () => {
      cancel()
    }
  }, [symbol, timeRange, customStart, customEnd, fetchData, cancel])

  // Handle time range changes
  const handleTimeRangeChange = (newRange: TimeRange, customStartDate?: string, customEndDate?: string) => {
    clearError()
    setTimeRange(newRange, customStartDate, customEndDate)
  }

  // Handle retry with different options
  const handleRetryWithRefresh = async () => {
    setShowRetryOptions(false)
    // Force refresh by re-fetching without cache
    if (symbol) {
      await fetchData([symbol], timeRange, customStart, customEnd)
    }
  }

  const handleShareUrl = () => {
    const url = getShareableUrl()
    navigator.clipboard.writeText(url).then(() => {
      alert('Share URL copied to clipboard!')
    }).catch(() => {
      prompt('Copy this URL to share:', url)
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{symbol}</h1>
              <p className="text-gray-600">Stock Analysis Dashboard</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleShareUrl}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                Share
              </button>
              <a
                href="/"
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Back to Portfolio
              </a>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="border-t border-gray-200 pt-4">
            <TimeRangeSelector
              selectedRange={timeRange}
              onRangeChange={handleTimeRangeChange}
              disabled={loading}
              showDateRange={true}
            />
          </div>

          {/* Data Status */}
          {lastFetched && !loading && (
            <div className="mt-4 text-xs text-gray-500">
              Last updated: {lastFetched.toLocaleString()}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <LoadingSpinner />
              <div className="text-center mt-4">
                <p className="text-gray-600">Fetching stock data for {symbol}...</p>
                <button
                  onClick={cancel}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-red-600 font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-red-800">
                      Failed to Load Data
                    </h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={retry}
                        className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Retry
                      </button>
                      <button
                        onClick={() => setShowRetryOptions(!showRetryOptions)}
                        className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Retry Options
                      </button>
                      <button
                        onClick={clearError}
                        className="px-4 py-2 text-sm text-red-600 hover:text-red-800 underline"
                      >
                        Dismiss
                      </button>
                    </div>
                    
                    {/* Retry Options */}
                    {showRetryOptions && (
                      <div className="mt-4 p-4 bg-red-25 rounded-lg border border-red-200">
                        <h4 className="text-sm font-medium text-red-800 mb-2">Retry Options</h4>
                        <div className="space-y-2">
                          <button
                            onClick={handleRetryWithRefresh}
                            className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-100 rounded"
                          >
                            Force refresh (bypass cache)
                          </button>
                          <button
                            onClick={() => handleTimeRangeChange('1D')}
                            className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-100 rounded"
                          >
                            Try with 1-day range
                          </button>
                          <button
                            onClick={() => handleTimeRangeChange('1M')}
                            className="block w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-100 rounded"
                          >
                            Try with 1-month range
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Display */}
          {data && !loading && !error && (
            <div className="space-y-6">
              {/* Chart Area - This is where Agent B's chart component would go */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {symbol} Price Chart
                  </h2>
                  <div className="text-sm text-gray-600">
                    {data.metadata.successful_tickers} of {data.metadata.total_tickers} tickers loaded
                  </div>
                </div>
                
                {/* Placeholder for chart - Agent B will replace this */}
                <div className="h-96 bg-gray-50 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-2">📈</div>
                    <div className="text-lg font-medium">Chart Component</div>
                    <div className="text-sm">Agent B will integrate chart here</div>
                    <div className="text-xs mt-2">
                      {data.data[symbol]?.data.length || 0} data points available
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Summary */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Data Summary</h3>
                {data.data[symbol] && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900">Data Points</h4>
                      <p className="text-2xl font-bold text-blue-600">
                        {data.data[symbol].data.length}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <h4 className="font-medium text-green-900">Start Date</h4>
                      <p className="text-sm font-bold text-green-600">
                        {new Date(data.data[symbol].date_range.start).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <h4 className="font-medium text-purple-900">End Date</h4>
                      <p className="text-sm font-bold text-purple-600">
                        {new Date(data.data[symbol].date_range.end).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">Load Time</h4>
                      <p className="text-lg font-bold text-gray-600">
                        {data.metadata.execution_time?.toFixed(2)}s
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Raw Data Preview */}
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Data</h3>
                {data.data[symbol] && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 font-medium text-gray-700">Date</th>
                          <th className="text-right py-2 font-medium text-gray-700">Open</th>
                          <th className="text-right py-2 font-medium text-gray-700">High</th>
                          <th className="text-right py-2 font-medium text-gray-700">Low</th>
                          <th className="text-right py-2 font-medium text-gray-700">Close</th>
                          <th className="text-right py-2 font-medium text-gray-700">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.data[symbol].data.slice(-10).reverse().map((row, index) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2">{new Date(row.Date).toLocaleDateString()}</td>
                            <td className="text-right py-2">${row.Open?.toFixed(2)}</td>
                            <td className="text-right py-2">${row.High?.toFixed(2)}</td>
                            <td className="text-right py-2">${row.Low?.toFixed(2)}</td>
                            <td className="text-right py-2">${row.Close?.toFixed(2)}</td>
                            <td className="text-right py-2">{row.Volume?.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}