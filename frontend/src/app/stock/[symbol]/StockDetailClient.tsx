'use client'

import { useState, memo, useCallback } from 'react'
import Link from 'next/link'
import { SingleStockResponse, TabId, TabItem, TimeRange } from '@/types/stock'
import { StockChart } from '@/components/StockChart'
import { TimeRangeSelector } from '@/components/TimeRangeSelector'
import { calculatePerformanceMetrics, formatPercentage, formatNumber, getRiskLevel, PerformanceMetrics } from '@/utils/financialCalculations'
import { formatCurrency, formatMarketCap, formatRatio, formatDate, formatVolume, getValueColorClass } from '@/utils/formatting'
import { apiRequest, API_ENDPOINTS } from '@/utils/api'
import { calculateStartDate, calculateEndDate } from '@/utils/timeRange'

interface StockDetailClientProps {
  stockData: SingleStockResponse
}

export default function StockDetailClient({ stockData: initialStockData }: StockDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [timeRange, setTimeRange] = useState<TimeRange>('6M')
  const [stockData, setStockData] = useState<SingleStockResponse>(initialStockData)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  // Fetch data for new time range
  const fetchDataForTimeRange = useCallback(async (
    range: TimeRange,
    customStart?: string,
    customEnd?: string
  ) => {
    setIsLoadingData(true)
    setDataError(null)
    
    try {
      const startDate = customStart || calculateStartDate(range, undefined, 1) // Single ticker scenario
      const endDate = customEnd || calculateEndDate(range)
      
      const response = await apiRequest(API_ENDPOINTS.FETCH_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers: [stockData.symbol],
          start_date: startDate,
          end_date: endDate,
          include_dividends: true,
          max_workers: 1
        }),
        timeout: 10000,
        retries: 2
      })
      
      if (response.data && response.data[stockData.symbol]) {
        const newStockInfo = response.data[stockData.symbol]
        const newDividendData = response.dividend_data?.[stockData.symbol]
        
        // Check if we actually have data points
        if (newStockInfo.data && newStockInfo.data.length > 0) {
          // Update stock data with new information
          setStockData({
            ...stockData,
            data: newStockInfo.data,
            date_range: newStockInfo.date_range,
            dividend_data: newDividendData,
            // Update computed values
            current_price: newStockInfo.data[newStockInfo.data.length - 1].Close,
            price_change: newStockInfo.data.length > 1 
              ? newStockInfo.data[newStockInfo.data.length - 1].Close - newStockInfo.data[newStockInfo.data.length - 2].Close 
              : stockData.price_change,
            price_change_percent: newStockInfo.data.length > 1 
              ? ((newStockInfo.data[newStockInfo.data.length - 1].Close - newStockInfo.data[newStockInfo.data.length - 2].Close) / newStockInfo.data[newStockInfo.data.length - 2].Close) * 100
              : stockData.price_change_percent,
          })
        } else {
          setDataError('No data available for the selected time range. Market may be closed or no trading data exists for these dates.')
        }
      } else {
        setDataError('No data available for the selected time range. Market may be closed or no trading data exists for these dates.')
      }
    } catch (err) {
      console.error('Failed to fetch data for time range:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data for the selected time range'
      setDataError(errorMessage)
    } finally {
      setIsLoadingData(false)
    }
  }, [stockData.symbol, stockData.current_price, stockData.price_change, stockData.price_change_percent])

  // Handle time range change
  const handleTimeRangeChange = useCallback((
    range: TimeRange,
    customStart?: string,
    customEnd?: string
  ) => {
    setTimeRange(range)
    fetchDataForTimeRange(range, customStart, customEnd)
  }, [fetchDataForTimeRange])

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    const tabIds = tabs.map(tab => tab.id)
    
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabIds.length - 1
        setActiveTab(tabIds[prevIndex])
        break
      case 'ArrowRight':
        e.preventDefault()
        const nextIndex = currentIndex < tabIds.length - 1 ? currentIndex + 1 : 0
        setActiveTab(tabIds[nextIndex])
        break
      case 'Home':
        e.preventDefault()
        setActiveTab(tabIds[0])
        break
      case 'End':
        e.preventDefault()
        setActiveTab(tabIds[tabIds.length - 1])
        break
      case ' ':
      case 'Enter':
        e.preventDefault()
        setActiveTab(tabIds[currentIndex])
        break
    }
  }

  const tabs: TabItem[] = [
    { id: 'overview' as TabId, label: 'Overview', icon: '📊' },
    { id: 'charts' as TabId, label: 'Charts', icon: '📈' },
    ...(stockData.dividend_data ? [{ id: 'dividends' as TabId, label: 'Dividends', icon: '💰' }] : []),
    { id: 'performance' as TabId, label: 'Performance', icon: '⚡' },
    { id: 'financials' as TabId, label: 'Financials', icon: '📋' }
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Breadcrumb */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">{stockData.symbol}</span>
          </div>
        </nav>

        {/* Stock Header */}
        <StockHeader stockData={stockData} />

        {/* Navigation Tabs */}
        <div className="bg-white rounded-xl shadow-lg mt-6">
          <div className="border-b border-gray-200">
            <nav 
              className="flex space-x-8 px-6" 
              role="tablist"
              aria-label="Stock information sections"
            >
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div 
            className="p-6"
            role="tabpanel"
            id={`tabpanel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'overview' && <OverviewTab stockData={stockData} />}
            {activeTab === 'charts' && (
              <ChartsTab 
                stockData={stockData}
                timeRange={timeRange}
                onTimeRangeChange={handleTimeRangeChange}
                isLoading={isLoadingData}
                error={dataError}
              />
            )}
            {activeTab === 'dividends' && stockData.dividend_data && (
              <DividendsTab stockData={stockData} />
            )}
            {activeTab === 'performance' && <PerformanceTab stockData={stockData} />}
            {activeTab === 'financials' && <FinancialsTab />}
          </div>
        </div>
      </div>
    </main>
  )
}

const StockHeader = memo(function StockHeader({ stockData }: { stockData: SingleStockResponse }) {
  const isPositive = (stockData.price_change || 0) >= 0

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{stockData.symbol}</h1>
            {stockData.company_name && (
              <p className="text-lg text-gray-600 mt-1">{stockData.company_name}</p>
            )}
          </div>
          
          {/* Stock Badge */}
          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            Stock
          </div>
        </div>

        {/* Price Information */}
        <div className="text-right">
          {stockData.current_price && (
            <div className="text-3xl font-bold text-gray-900">
              ${stockData.current_price.toFixed(2)}
            </div>
          )}
          {stockData.price_change !== undefined && stockData.price_change_percent !== undefined && (
            <div className={`text-lg font-medium flex items-center justify-end ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
              <span 
                className={`inline-flex items-center mr-1 ${isPositive ? 'text-green-700' : 'text-red-600'}`}
                aria-label={isPositive ? 'Price increased' : 'Price decreased'}
              >
                {isPositive ? (
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414 6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {isPositive ? '+' : ''}${stockData.price_change.toFixed(2)}
              </span>
              <span className="ml-1">
                ({isPositive ? '+' : ''}{stockData.price_change_percent.toFixed(2)}%)
              </span>
            </div>
          )}
          <div className="text-sm text-gray-500 mt-1">
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      {(stockData.market_cap || stockData.pe_ratio || stockData.dividend_yield) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          {stockData.market_cap && (
            <div className="text-center">
              <p className="text-sm text-gray-500">Market Cap</p>
              <p className="text-lg font-medium">{formatMarketCap(stockData.market_cap)}</p>
            </div>
          )}
          {stockData.pe_ratio && (
            <div className="text-center">
              <p className="text-sm text-gray-500">P/E Ratio</p>
              <p className="text-lg font-medium">{formatRatio(stockData.pe_ratio)}</p>
            </div>
          )}
          {stockData.dividend_yield && (
            <div className="text-center">
              <p className="text-sm text-gray-500">Dividend Yield</p>
              <p className="text-lg font-medium">{formatRatio(stockData.dividend_yield)}%</p>
            </div>
          )}
          {stockData.fifty_two_week_high && stockData.fifty_two_week_low && (
            <div className="text-center">
              <p className="text-sm text-gray-500">52W Range</p>
              <p className="text-lg font-medium">
                {formatCurrency(stockData.fifty_two_week_low)} - {formatCurrency(stockData.fifty_two_week_high)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

const OverviewTab = memo(function OverviewTab({ stockData }: { stockData: SingleStockResponse }) {
  // Add defensive checks for data access
  const dataPoints = stockData.data?.length || 0
  const startDate = stockData.date_range?.start ? new Date(stockData.date_range.start).toLocaleDateString() : 'N/A'
  const endDate = stockData.date_range?.end ? new Date(stockData.date_range.end).toLocaleDateString() : 'N/A'
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Data Points</h3>
          <p className="text-2xl font-bold text-blue-600">{dataPoints}</p>
          <p className="text-sm text-blue-700">Historical records</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Date Range</h3>
          <p className="text-sm font-bold text-green-600">{startDate}</p>
          <p className="text-sm text-green-700">to {endDate}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900">Symbol</h3>
          <p className="text-2xl font-bold text-purple-600">{stockData.symbol}</p>
          <p className="text-sm text-purple-700">Stock ticker</p>
        </div>
      </div>

      {/* Dividend Preview */}
      {stockData.dividend_data && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900 flex items-center">
                <span className="text-lg mr-2">💰</span>
                Dividend Information Available
              </h4>
              <p className="text-sm text-green-700 mt-1">
                {stockData.dividend_data.dividend_count > 0 
                  ? `${stockData.dividend_data.dividend_count} dividend payments totaling $${stockData.dividend_data.total_dividends.toFixed(2)}`
                  : "Dividend analysis completed for this stock"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600">Total Dividends</p>
              <p className="text-xl font-bold text-green-800">
                ${stockData.dividend_data.total_dividends.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Data Preview */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Price Data</h3>
        <div className="overflow-x-auto">
          {/* Desktop Table */}
          <table 
            className="min-w-full text-sm hidden md:table"
            role="table"
            aria-label="Recent stock price data for the last 10 trading days"
          >
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2" scope="col">Date</th>
                <th className="text-right py-2" scope="col">Open</th>
                <th className="text-right py-2" scope="col">High</th>
                <th className="text-right py-2" scope="col">Low</th>
                <th className="text-right py-2" scope="col">Close</th>
                <th className="text-right py-2" scope="col">Volume</th>
              </tr>
            </thead>
            <tbody>
              {(stockData.data || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-sm">No price data available for this symbol</p>
                      <p className="text-xs text-gray-400 mt-1">Data may not be available or symbol may be incorrect</p>
                    </div>
                  </td>
                </tr>
              ) : (
                (stockData.data || []).slice(-10).reverse().map((row, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2">{row.Date ? new Date(row.Date).toLocaleDateString() : 'N/A'}</td>
                    <td className="text-right py-2">${row.Open?.toFixed(2) || 'N/A'}</td>
                    <td className="text-right py-2">${row.High?.toFixed(2) || 'N/A'}</td>
                    <td className="text-right py-2">${row.Low?.toFixed(2) || 'N/A'}</td>
                    <td className="text-right py-2">${row.Close?.toFixed(2) || 'N/A'}</td>
                    <td className="text-right py-2">{row.Volume?.toLocaleString() || 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          
          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-3">
            {(stockData.data || []).length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <div className="flex flex-col items-center">
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm">No price data available for this symbol</p>
                  <p className="text-xs text-gray-400 mt-1">Data may not be available or symbol may be incorrect</p>
                </div>
              </div>
            ) : (
              (stockData.data || []).slice(-10).reverse().map((row, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">
                      {row.Date ? new Date(row.Date).toLocaleDateString() : 'N/A'}
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      ${row.Close?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Open:</span>
                      <span className="font-medium">${row.Open?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">High:</span>
                      <span className="font-medium text-green-600">${row.High?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Low:</span>
                      <span className="font-medium text-red-600">${row.Low?.toFixed(2) || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Volume:</span>
                      <span className="font-medium">{row.Volume?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Showing last 10 trading days
        </p>
      </div>
    </div>
  )
})

interface ChartsTabProps {
  stockData: SingleStockResponse
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange, customStart?: string, customEnd?: string) => void
  isLoading?: boolean
  error?: string | null
}

const ChartsTab = memo(function ChartsTab({ 
  stockData, 
  timeRange, 
  onTimeRangeChange,
  isLoading,
  error
}: ChartsTabProps) {
  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Price Chart</h3>
        <TimeRangeSelector
          selectedRange={timeRange}
          onRangeChange={onTimeRangeChange}
          className="ml-auto"
          disabled={isLoading}
          showDateRange={true}
        />
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-8">
          <div className="flex flex-col items-center space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-sm text-gray-500">Loading chart data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Interactive Stock Chart */}
      {!isLoading && !error && (
        <>
          <StockChart
            data={stockData.data}
            ticker={stockData.symbol}
            height="500px"
            chartType="line"
            dividendOverlay={{
              showMarkers: true,
              showTooltips: true,
              markerSize: 8,
              markerColor: '#dc2626'
            }}
            timeRange={timeRange}
            showGrid={true}
            enableCrosshair={true}
            maxDataPoints={500}
            priceField="Close"
            className="shadow-lg"
          />

          {/* Chart Info */}
          <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Chart Features</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
          <div className="flex items-center">
            <span className="w-2 h-2 bg-blue-600 rounded-full mr-2"></span>
            Interactive price data with hover details
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
            Dividend markers (toggle to show/hide)
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
            Multiple time range selections
          </div>
          <div className="flex items-center">
            <span className="w-2 h-2 bg-purple-600 rounded-full mr-2"></span>
            Responsive design with crosshair
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
})

const DividendsTab = memo(function DividendsTab({ stockData }: { stockData: SingleStockResponse }) {
  // Early return if dividend_data is undefined
  if (!stockData.dividend_data) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💰</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Dividend Data Available</h3>
        <p className="text-gray-600">
          Dividend information is not available for this stock.
        </p>
      </div>
    )
  }
  
  const dividendData = stockData.dividend_data

  return (
    <div className="space-y-6">
      {/* Dividend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Total Dividend Income</h3>
          <p className="text-2xl font-bold text-green-600">${dividendData.total_dividends.toFixed(2)}</p>
          <p className="text-sm text-green-700">For selected period</p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Total Payments</h3>
          <p className="text-2xl font-bold text-blue-600">{dividendData.dividend_count}</p>
          <p className="text-sm text-blue-700">Dividend distributions</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900">Avg per Payment</h3>
          <p className="text-2xl font-bold text-purple-600">
            ${dividendData.dividend_count > 0 ? (dividendData.total_dividends / dividendData.dividend_count).toFixed(2) : '0.00'}
          </p>
          <p className="text-sm text-purple-700">Average distribution</p>
        </div>
      </div>

      {/* Dividend Payment History */}
      {dividendData.dividends.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Dividend Payment History</h3>
          </div>
          <div className="overflow-x-auto">
            <table 
              className="min-w-full divide-y divide-gray-200"
              role="table"
              aria-label="Dividend payment history"
            >
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    scope="col"
                  >
                    Ex-Date
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    scope="col"
                  >
                    Amount
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    scope="col"
                  >
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {dividendData.dividends.map((dividend, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {dividend.ex_date ? new Date(dividend.ex_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${dividend.dividend_amount?.toFixed(4) || '0.0000'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {dividend.dividend_type || 'regular'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Dividends Message */}
      {dividendData.dividend_count === 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dividends Found</h3>
          <p className="text-gray-600">
            This stock did not pay dividends in the selected time period, or it may not be a dividend-paying security.
          </p>
        </div>
      )}
    </div>
  )
})

const PerformanceTab = memo(function PerformanceTab({ stockData }: { stockData: SingleStockResponse }) {
  // Early return if no data available
  if (!stockData.data || stockData.data.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚡</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Performance Data Available</h3>
        <p className="text-gray-600">
          Performance metrics cannot be calculated without price data.
        </p>
      </div>
    )
  }

  // Calculate basic performance metrics with safe array access
  const firstPrice = stockData.data.length > 0 ? stockData.data[0]?.Close : undefined
  const lastPrice = stockData.data.length > 0 ? stockData.data[stockData.data.length - 1]?.Close : undefined
  const totalReturn = firstPrice && lastPrice ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0
  
  // Safe calculation of highest and lowest with bounds checking
  const validHighs = stockData.data.map(d => d.High).filter((high): high is number => high !== undefined && !isNaN(high))
  const validLows = stockData.data.map(d => d.Low).filter((low): low is number => low !== undefined && !isNaN(low))
  
  const highest = validHighs.length > 0 ? Math.max(...validHighs) : 0
  const lowest = validLows.length > 0 ? Math.min(...validLows) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Total Return</h3>
          <p className={`text-2xl font-bold flex items-center ${totalReturn >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            <span 
              className={`inline-flex items-center mr-1 ${totalReturn >= 0 ? 'text-green-700' : 'text-red-600'}`}
              aria-label={totalReturn >= 0 ? 'Positive return' : 'Negative return'}
            >
              {totalReturn >= 0 ? (
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414 6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </span>
          </p>
          <p className="text-sm text-blue-700">For selected period</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Price Range</h3>
          <p className="text-lg font-bold text-green-600">
            ${lowest.toFixed(2)} - ${highest.toFixed(2)}
          </p>
          <p className="text-sm text-green-700">High/Low in period</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Data Points</span>
            <span className="font-medium">{stockData.data.length}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Start Price</span>
            <span className="font-medium">${firstPrice?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">End Price</span>
            <span className="font-medium">${lastPrice?.toFixed(2) || 'N/A'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Highest Price</span>
            <span className="font-medium">${highest.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Lowest Price</span>
            <span className="font-medium">${lowest.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
})

const FinancialsTab = memo(function FinancialsTab() {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Financial Data Coming Soon</h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Detailed financial statements, ratios, and analysis will be available here.
          This will include income statements, balance sheets, and key financial metrics.
        </p>
      </div>
    </div>
  )
})