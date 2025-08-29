'use client'

import { useState } from 'react'

interface TickerInputProps {
  onAnalyze: (tickers: string[], options: any) => void
}

export function TickerInput({ onAnalyze }: TickerInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [startDate, setStartDate] = useState(() => {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    return sixMonthsAgo.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [forceRefresh, setForceRefresh] = useState(false)
  const [error, setError] = useState('')

  // Popular ticker suggestions
  const popularTickers = [
    { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' }
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Parse comma-separated tickers
    const tickers = inputValue
      .split(',')
      .map(ticker => ticker.trim().toUpperCase())
      .filter(ticker => ticker.length > 0)
    
    if (tickers.length === 0) {
      setError('Please enter at least one ticker symbol')
      return
    }

    if (tickers.length > 20) {
      setError('Please enter no more than 20 ticker symbols')
      return
    }

    setError('')

    onAnalyze(tickers, {
      startDate,
      endDate,
      forceRefresh,
      includeDividends: true
    })
  }

  const addPopularTicker = (symbol: string) => {
    const currentTickers = inputValue
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0)
    
    if (!currentTickers.includes(symbol)) {
      const newValue = currentTickers.length > 0 
        ? inputValue + ', ' + symbol 
        : symbol
      setInputValue(newValue)
    }
  }

  return (
    <div className="space-y-6" role="main" aria-label="Portfolio analysis input form">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Portfolio Analysis
        </h2>
        <p className="text-gray-600">
          Enter stock tickers or ETF symbols to analyze their performance and optimize your portfolio
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" role="form" aria-label="Stock ticker analysis form">
        {/* Ticker Input */}
        <div>
          <label htmlFor="tickers" className="block text-sm font-medium text-gray-700 mb-2">
            Stock Tickers (comma-separated)
          </label>
          <textarea
            id="tickers"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="AAPL, SPY, QQQ, VTI, MSFT..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 bg-white placeholder-gray-500 dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400"
            rows={3}
            required
            aria-describedby="tickers-help"
            aria-invalid={inputValue.split(',').length > 20 ? 'true' : 'false'}
          />
          {error && (
            <div className="mt-1 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200" role="alert">
              {error}
            </div>
          )}
          <p id="tickers-help" className="mt-1 text-sm text-gray-500">
            Enter up to 20 ticker symbols separated by commas
          </p>
        </div>

        {/* Popular Tickers */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Popular selections:</p>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {popularTickers.map((ticker) => (
              <button
                key={ticker.symbol}
                type="button"
                onClick={() => addPopularTicker(ticker.symbol)}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-blue-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation"
                title={`Add ${ticker.symbol} (${ticker.name}) to analysis`}
                aria-label={`Add ${ticker.symbol} to analysis`}
              >
                <span className="text-xs mr-1">+</span>
                {ticker.symbol}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click + to add tickers to your analysis
          </p>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
              required
            />
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="forceRefresh"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="forceRefresh" className="text-sm text-gray-700">
              Force refresh data (bypass cache)
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[48px] touch-manipulation"
        >
          Analyze Portfolio
        </button>
      </form>

      {/* Data Source Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Data Sources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            AlphaVantage
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Tiingo
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
            Finnhub
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            YFinance
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Our system automatically uses the best available data source with intelligent fallback
        </p>
      </div>
    </div>
  )
}