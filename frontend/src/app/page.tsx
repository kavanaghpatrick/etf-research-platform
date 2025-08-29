'use client'

import { useState } from 'react'
import { TickerInput } from '@/components/TickerInput'
import { LazyResultsDashboard } from '@/components/LazyResultsDashboard'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { apiRequest, API_ENDPOINTS, createApiError } from '@/utils/api'

interface AnalysisOptions {
  startDate: string
  endDate: string
  forceRefresh: boolean
  includeDividends: boolean
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchError, setSearchError] = useState('')

  const validateTicker = (value: string) => {
    const ticker = value.trim().toUpperCase()
    if (!ticker) {
      setSearchError('')
      return
    }
    if (!/^[A-Z]{1,8}$/.test(ticker)) {
      setSearchError('Please enter 1-8 letters only')
    } else {
      setSearchError('')
    }
  }

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    validateTicker(value)
  }

  const handleSearchSubmit = (ticker: string) => {
    const cleanTicker = ticker.trim().toUpperCase()
    if (cleanTicker && /^[A-Z]{1,8}$/.test(cleanTicker)) {
      window.location.href = `/stock/${cleanTicker.toLowerCase()}`
    } else {
      setSearchError('Please enter a valid ticker symbol')
    }
  }

  const handleAnalysis = async (tickers: string[], options: AnalysisOptions) => {
    setIsLoading(true)
    setError(null)
    setResults(null)

    try {
      // Use centralized API request with timeout and retry logic
      const data = await apiRequest(API_ENDPOINTS.FETCH_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers,
          start_date: options.startDate,
          end_date: options.endDate,
          force_refresh: options.forceRefresh,
          include_dividends: options.includeDividends,
          max_workers: 5
        }),
        timeout: 10000, // 10 second timeout
        retries: 2 // Retry failed requests
      })
      
      setResults(data)
    } catch (err) {
      // Check if error is already an ApiErrorInfo object
      const errorInfo = (err && typeof err === 'object' && 'type' in err && 'message' in err) 
        ? err as any
        : createApiError(err)
      setError(errorInfo.message)
      console.error('API Error:', {
        type: errorInfo.type,
        message: errorInfo.message,
        timestamp: new Date(errorInfo.timestamp).toISOString()
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            ETF Research Platform
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Advanced stock and ETF analysis with interactive charts and real-time data
          </p>
          <div className="flex justify-center space-x-6 text-sm text-gray-500">
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Interactive Charts
            </span>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              Dividend Analysis
            </span>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
              Portfolio Tools
            </span>
          </div>
        </div>

        {/* Quick Stock Search */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Search Any Stock or ETF
            </h2>
            <div className="flex justify-center">
              <div className="relative w-full max-w-md">
                <label htmlFor="quick-search" className="sr-only">
                  Search for stocks or ETFs by ticker symbol
                </label>
                <input
                  id="quick-search"
                  type="text"
                  value={searchValue}
                  onChange={handleSearchInput}
                  placeholder="Enter ticker symbol (e.g., SPY, AAPL, VTI)"
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent text-center text-lg text-gray-900 bg-white placeholder-gray-500 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 ${
                    searchError 
                      ? 'border-red-300 focus:ring-red-500' 
                      : searchValue && !searchError 
                      ? 'border-green-300 focus:ring-green-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  aria-describedby={searchError ? 'search-error search-help' : 'search-help'}
                  aria-invalid={searchError ? 'true' : 'false'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchSubmit(searchValue)
                    }
                  }}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                {searchError && (
                  <div id="search-error" className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200 text-center" role="alert">
                    {searchError}
                  </div>
                )}
                <p id="search-help" className="mt-2 text-sm text-gray-600 text-center">
                  Press Enter to search, or click on popular picks below
                </p>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-2">
              Press Enter to view detailed charts and analysis
            </p>
          </div>
        </div>

        {/* Popular ETFs & Stocks */}
        <div className="max-w-6xl mx-auto mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Popular ETFs & Stocks</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { symbol: 'SPY', name: 'S&P 500 ETF' },
                { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
                { symbol: 'VTI', name: 'Total Stock Market' },
                { symbol: 'VEA', name: 'Developed Markets' },
                { symbol: 'VWO', name: 'Emerging Markets' },
                { symbol: 'GLD', name: 'Gold ETF' },
                { symbol: 'AAPL', name: 'Apple Inc.' },
                { symbol: 'MSFT', name: 'Microsoft Corp.' },
                { symbol: 'GOOGL', name: 'Alphabet Inc.' },
                { symbol: 'TSLA', name: 'Tesla Inc.' },
                { symbol: 'NVDA', name: 'NVIDIA Corp.' },
                { symbol: 'META', name: 'Meta Platforms' }
              ].map((stock) => (
                <a
                  key={stock.symbol}
                  href={`/stock/${stock.symbol.toLowerCase()}`}
                  className="bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 text-center transition-colors cursor-pointer min-h-[44px] flex flex-col justify-center touch-manipulation"
                >
                  <div className="font-semibold text-gray-900">{stock.symbol}</div>
                  <div className="text-xs text-gray-600 mt-1">{stock.name}</div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Portfolio Analysis Section */}
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Multi-Ticker Portfolio Analysis</h2>
            <p className="text-gray-600 mb-4">
              Compare multiple stocks or ETFs side-by-side with advanced portfolio analytics.
            </p>
            {!results && !isLoading && (
              <TickerInput onAnalyze={handleAnalysis} />
            )}
          </div>

          {isLoading && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <LoadingSpinner />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-red-600 font-bold">!</span>
                  </div>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Analysis Error
                  </h3>
                  <p className="mt-1 text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {results && (
            <LazyResultsDashboard 
              results={results} 
              onNewAnalysis={() => {
                setResults(null)
                setError(null)
              }}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-500 text-sm">
          <p>Built with resilient data architecture • Powered by AlphaVantage, Tiingo, Finnhub, YFinance</p>
        </footer>
      </div>
    </main>
  )
}
