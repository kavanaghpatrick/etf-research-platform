'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { TickerLink, TickerBadge } from './TickerLink'
import { NormalizedMultiTickerChart } from './NormalizedMultiTickerChart'
import { TimeRangeSelector } from './TimeRangeSelector'
import { TimeRange } from '@/types/stock'
import { calculateStartDate, calculateEndDate } from '@/utils/timeRange'
import { apiRequest, API_ENDPOINTS } from '@/utils/api'

interface ResultsDashboardProps {
  results: any
  onNewAnalysis: () => void
}

export function ResultsDashboard({ results, onNewAnalysis }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!results) return null

  const { data, metadata, source_health, dividend_data } = results

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'chart', label: 'Chart', icon: '📈' },
    { id: 'data', label: 'Data', icon: '📋' },
    { id: 'dividends', label: 'Dividends', icon: '💰' },
    { id: 'sources', label: 'Sources', icon: '🔗' },
    { id: 'performance', label: 'Performance', icon: '⚡' }
  ]

  return (
    <div className="space-y-6" role="main" aria-label="Analysis results dashboard">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
            <p className="text-gray-600 mt-1">
              {metadata.successful_tickers} of {metadata.total_tickers} tickers analyzed successfully
            </p>
          </div>
          <button
            onClick={onNewAnalysis}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] touch-manipulation"
            aria-label="Start a new portfolio analysis"
          >
            New Analysis
          </button>
        </div>

        {/* Success Rate Indicator */}
        <div className="mt-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Success Rate</span>
                <span>{(metadata.success_rate * 100).toFixed(1)}%</span>
              </div>
              <div 
                className="w-full bg-gray-200 rounded-full h-2"
                role="progressbar"
                aria-valuenow={metadata.success_rate * 100}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Analysis success rate: ${(metadata.success_rate * 100).toFixed(1)}%`}
              >
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${metadata.success_rate * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {metadata.execution_time?.toFixed(2)}s
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="border-b border-gray-200">
          <nav className="flex flex-wrap gap-2 sm:space-x-8 sm:gap-0 px-4 sm:px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 sm:px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap min-h-[44px] touch-manipulation focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-label={`View ${tab.label} tab`}
              >
                <span className="mr-2">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab data={data} metadata={metadata} dividendData={dividend_data} onSwitchToDividends={() => setActiveTab('dividends')} />
          )}
          {activeTab === 'chart' && (
            <ChartTab data={data} />
          )}
          {activeTab === 'data' && (
            <DataTab data={data} />
          )}
          {activeTab === 'dividends' && (
            <DividendsTab dividendData={dividend_data} />
          )}
          {activeTab === 'sources' && (
            <SourcesTab sourceHealth={source_health} metadata={metadata} />
          )}
          {activeTab === 'performance' && (
            <PerformanceTab metadata={metadata} />
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ data, metadata, dividendData, onSwitchToDividends }: { 
  data: any, 
  metadata: any, 
  dividendData?: any, 
  onSwitchToDividends?: () => void 
}) {
  const tickers = Object.keys(data)
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Total Tickers</h3>
          <p className="text-2xl font-bold text-blue-600">{metadata.total_tickers}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Successful</h3>
          <p className="text-2xl font-bold text-green-600">{metadata.successful_tickers}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900">Data Points</h3>
          <p className="text-2xl font-bold text-purple-600">
            {Object.values(data).reduce((total: number, ticker: any) => total + ticker.data.length, 0)}
          </p>
        </div>
      </div>

      {/* Dividend Teaser */}
      {dividendData && onSwitchToDividends && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900 flex items-center">
                <span className="text-lg mr-2">💰</span>
                Dividend Income Detected
              </h4>
              <p className="text-sm text-green-700 mt-1">
                {(() => {
                  const totalDividends = Object.values(dividendData).reduce((sum: number, data: any) => 
                    sum + (data.total_dividends || 0), 0)
                  const totalCount = Object.values(dividendData).reduce((sum: number, data: any) => 
                    sum + (data.dividend_count || 0), 0)
                  return totalCount > 0 
                    ? `This portfolio generated $${totalDividends.toFixed(2)} from ${totalCount} dividend payments`
                    : "Dividend analysis available for this portfolio"
                })()}
              </p>
            </div>
            <button 
              onClick={onSwitchToDividends}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors text-sm font-medium"
            >
              View Dividends
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ticker Summary</h3>
        <div className="grid gap-4 sm:gap-6">
          {tickers.map((ticker) => {
            const tickerData = data[ticker]
            return (
              <div key={ticker} className="border border-gray-200 rounded-lg p-4 sm:p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <TickerLink 
                          ticker={ticker}
                          variant="default"
                          size="md"
                          className="text-lg font-semibold"
                          ariaLabel={`View detailed analysis for ${ticker}`}
                        />
                        <p className="text-sm text-gray-600">
                          {tickerData.data.length} data points
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-sm text-gray-600">Date Range</p>
                        <p className="text-sm font-medium">
                          {new Date(tickerData.date_range.start).toLocaleDateString()} - {new Date(tickerData.date_range.end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-gray-500 font-medium">
                        Latest: ${tickerData.data[tickerData.data.length - 1]?.Close?.toFixed(2) || 'N/A'}
                      </div>
                      <Link
                        href={`/stock/${ticker.toLowerCase()}`}
                        className="inline-flex items-center justify-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px] touch-manipulation focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label={`View detailed analysis for ${ticker}`}
                      >
                        View Details
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ChartTab({ data: initialData }: { data: any }) {
  const tickers = Object.keys(initialData)
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('6M')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chartData, setChartData] = useState(initialData)
  const [lastOperation, setLastOperation] = useState<'cached' | 'filtered' | 'fetched' | null>(null)
  
  // Cache to store fetched data by time range to avoid unnecessary API calls
  const [dataCache, setDataCache] = useState<Map<string, any>>(new Map([
    ['6M', initialData] // Start with initial data as 6M cache
  ]))
  
  // Track the maximum date range we've fetched to enable client-side filtering
  const [maxFetchedRange, setMaxFetchedRange] = useState<TimeRange>('6M')
  
  // Helper function to determine if we can use client-side filtering instead of API call
  const canUseClientSideFiltering = useCallback((targetRange: TimeRange) => {
    if (targetRange === 'CUSTOM') return false // Always fetch for custom ranges
    
    // Define range hierarchy (smaller ranges can use data from larger ranges)
    const rangeHierarchy: Record<TimeRange, number> = {
      '1D': 1,
      '5D': 5, 
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
      '5Y': 1825,
      'MAX': 9999,
      'CUSTOM': 0
    }
    
    const targetDays = rangeHierarchy[targetRange]
    const maxFetchedDays = rangeHierarchy[maxFetchedRange]
    
    // We can filter client-side if we have fetched a larger range than what's requested
    return targetDays <= maxFetchedDays && dataCache.has(maxFetchedRange)
  }, [maxFetchedRange, dataCache])
  
  // Helper function to filter existing data for a specific time range
  const filterDataForTimeRange = useCallback((
    sourceData: any, 
    timeRange: TimeRange,
    customStart?: string,
    customEnd?: string
  ) => {
    const startDate = customStart || calculateStartDate(timeRange, undefined, tickers.length)
    const endDate = customEnd || calculateEndDate(timeRange)
    
    const filteredData: any = {}
    
    Object.entries(sourceData).forEach(([ticker, tickerData]: [string, any]) => {
      if (tickerData?.data) {
        const filteredTickerData = tickerData.data.filter((item: any) => {
          const itemDate = item.Date.split('T')[0] // Handle both date and datetime formats
          return itemDate >= startDate && itemDate <= endDate
        })
        
        filteredData[ticker] = {
          ...tickerData,
          data: filteredTickerData,
          date_range: {
            start: startDate,
            end: endDate
          }
        }
      }
    })
    
    return filteredData
  }, [])
  
  // Intelligent data fetching with client-side filtering optimization
  const fetchDataForTimeRange = useCallback(async (
    timeRange: TimeRange, 
    customStart?: string, 
    customEnd?: string
  ) => {
    const cacheKey = customStart && customEnd ? `${timeRange}-${customStart}-${customEnd}` : timeRange
    
    // Check if we can use client-side filtering instead of API call
    if (canUseClientSideFiltering(timeRange) && !customStart && !customEnd) {
      console.log(`[ChartTab] Using client-side filtering for ${timeRange} from cached ${maxFetchedRange} data`)
      const sourceData = dataCache.get(maxFetchedRange)
      if (sourceData) {
        // Add a tiny delay to show the user that something is happening
        // but make it much faster than an API call
        setIsLoading(true)
        setTimeout(() => {
          const filteredData = filterDataForTimeRange(sourceData, timeRange)
          setChartData(filteredData)
          setLastOperation('filtered')
          setIsLoading(false)
        }, 100) // Very brief delay to prevent jarring instant changes
        return // Exit early - no API call needed
      }
    }
    
    // Check cache first for exact match
    const cachedData = dataCache.get(cacheKey)
    if (cachedData) {
      console.log(`[ChartTab] Using cached data for ${cacheKey}`)
      setChartData(cachedData)
      setLastOperation('cached')
      return
    }
    
    console.log(`[ChartTab] Fetching new data for ${timeRange}`)
    setIsLoading(true)
    setError(null)
    
    try {
      const startDate = customStart || calculateStartDate(timeRange, undefined, tickers.length)
      const endDate = customEnd || calculateEndDate(timeRange)
      
      console.log(`[DEBUG] Fetching data for ${timeRange}: ${startDate} to ${endDate}`)
      
      // Reduce workers for MAX range to avoid overwhelming the API
      const maxWorkers = timeRange === 'MAX' ? 3 : 5
      
      const response = await apiRequest(API_ENDPOINTS.FETCH_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers,
          start_date: startDate,
          end_date: endDate,
          include_dividends: true,
          max_workers: maxWorkers
        }),
        timeout: 30000, // Increased timeout for MAX range with multiple tickers
        retries: 2
      })
      
      if (response.data && Object.keys(response.data).length > 0) {
        // Cache the fetched data
        const newCache = new Map(dataCache)
        newCache.set(cacheKey, response.data)
        setDataCache(newCache)
        
        // Update max fetched range if this is a larger range than what we had
        const rangeHierarchy: Record<TimeRange, number> = {
          '1D': 1, '5D': 5, '1M': 30, '3M': 90, '6M': 180, 
          '1Y': 365, '5Y': 1825, 'MAX': 9999, 'CUSTOM': 0
        }
        
        if (!customStart && !customEnd && rangeHierarchy[timeRange] > rangeHierarchy[maxFetchedRange]) {
          setMaxFetchedRange(timeRange)
        }
        
        setChartData(response.data)
        setLastOperation('fetched')
      } else {
        setError('No data available for the selected time range. Market may be closed or no trading data exists for these dates.')
      }
    } catch (err) {
      console.error('Failed to fetch data for time range:', {
        timeRange,
        startDate: customStart || calculateStartDate(timeRange, undefined, tickers.length),
        endDate: customEnd || calculateEndDate(timeRange),
        error: err
      })
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data for the selected time range'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [tickers, dataCache, maxFetchedRange, canUseClientSideFiltering, filterDataForTimeRange])
  
  // Handle time range change
  const handleTimeRangeChange = useCallback((
    range: TimeRange, 
    customStart?: string, 
    customEnd?: string
  ) => {
    setSelectedTimeRange(range)
    if (customStart) setCustomStartDate(customStart)
    if (customEnd) setCustomEndDate(customEnd)
    
    // Fetch new data for the selected time range
    fetchDataForTimeRange(range, customStart, customEnd)
  }, [fetchDataForTimeRange])
  
  // Only show chart if we have multiple tickers
  if (tickers.length < 2) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">📊</span>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Single Ticker Analysis</h3>
        <p className="text-gray-600">
          The comparison chart requires at least 2 tickers. 
          For detailed single ticker analysis, visit the ticker's individual page.
        </p>
        <div className="mt-4">
          {tickers.map((ticker) => (
            <Link
              key={ticker}
              href={`/stock/${ticker.toLowerCase()}`}
              className="inline-flex items-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              View {ticker} Details
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Select Time Period</h4>
        <TimeRangeSelector
          selectedRange={selectedTimeRange}
          onRangeChange={handleTimeRangeChange}
          disabled={isLoading}
          showDateRange={true}
        />
      </div>
      
      {/* Chart Container - Keep stable height to prevent layout shifts */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm" style={{ minHeight: '500px' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="flex flex-col items-center space-y-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="text-sm text-gray-500">
                {lastOperation === 'filtered' ? 'Filtering data...' : 'Loading chart data...'}
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        ) : chartData ? (
          <NormalizedMultiTickerChart 
            tickersData={chartData}
            height="500px"
            className=""
          />
        ) : null}
      </div>
      
      {/* Info Cards */}
      {!isLoading && !error && chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Understanding the Chart</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• All tickers start at 0% on the first date</li>
                <li>• Lines show percentage change from the starting price</li>
                <li>• This allows fair comparison regardless of share price</li>
                <li>• Hover over the chart to see exact values</li>
              </ul>
            </div>
            
            {/* Performance Indicator */}
            {lastOperation && (
              <div className={`rounded-lg p-4 ${
                lastOperation === 'filtered' ? 'bg-green-50 border-green-200' :
                lastOperation === 'cached' ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50 border-gray-200'
              } border`}>
                <h4 className={`font-medium mb-2 ${
                  lastOperation === 'filtered' ? 'text-green-900' :
                  lastOperation === 'cached' ? 'text-yellow-900' :
                  'text-gray-900'
                }`}>
                  Performance Optimization
                </h4>
                <p className={`text-sm ${
                  lastOperation === 'filtered' ? 'text-green-800' :
                  lastOperation === 'cached' ? 'text-yellow-800' :
                  'text-gray-800'
                }`}>
                  {lastOperation === 'filtered' && '⚡ Client-side filtering - instant response using existing data'}
                  {lastOperation === 'cached' && '🔄 Cached data - fast response from local storage'}
                  {lastOperation === 'fetched' && '🌐 Fresh data - fetched from API'}
                </p>
              </div>
            )}
          </div>
      )}
    </div>
  )
}

function DataTab({ data }: { data: any }) {
  const [selectedTicker, setSelectedTicker] = useState(Object.keys(data)[0])
  const tickers = Object.keys(data)
  
  if (!selectedTicker) return <div>No data available</div>
  
  const tickerData = data[selectedTicker]
  
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Ticker
        </label>
        <select
          value={selectedTicker}
          onChange={(e) => setSelectedTicker(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {tickers.map((ticker) => (
            <option key={ticker} value={ticker}>{ticker}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-900">
            <TickerLink 
              ticker={selectedTicker}
              displayText={`${selectedTicker} Data Preview`}
              variant="default"
              size="md"
              ariaLabel={`View ${selectedTicker} stock details page`}
            />
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2">Date</th>
                <th className="text-right py-2">Open</th>
                <th className="text-right py-2">High</th>
                <th className="text-right py-2">Low</th>
                <th className="text-right py-2">Close</th>
                <th className="text-right py-2">Volume</th>
              </tr>
            </thead>
            <tbody>
              {tickerData.data.slice(0, 10).map((row: any, index: number) => (
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
        {tickerData.data.length > 10 && (
          <p className="text-xs text-gray-500 mt-2">
            Showing first 10 of {tickerData.data.length} data points
          </p>
        )}
      </div>
    </div>
  )
}

function SourcesTab({ sourceHealth, metadata }: { sourceHealth: any[], metadata: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Source Health</h3>
        <div className="grid gap-4">
          {sourceHealth.map((source) => (
            <div key={source.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${source.healthy ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <h4 className="font-medium text-gray-900">{source.name}</h4>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  source.healthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {source.healthy ? 'Healthy' : 'Degraded'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Success Rate</p>
                  <p className="font-medium">{source.success_rate}</p>
                </div>
                <div>
                  <p className="text-gray-600">Total Requests</p>
                  <p className="font-medium">{source.total_requests}</p>
                </div>
                <div>
                  <p className="text-gray-600">Avg Response</p>
                  <p className="font-medium">{source.average_response_time}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sources Used</h3>
        <p className="text-gray-600">
          {metadata.data_sources_used?.join(', ') || 'No sources listed'}
        </p>
      </div>
    </div>
  )
}

function PerformanceTab({ metadata }: { metadata: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Execution Time</h3>
          <p className="text-2xl font-bold text-blue-600">{metadata.execution_time?.toFixed(2)}s</p>
          <p className="text-sm text-blue-700">Total analysis time</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Success Rate</h3>
          <p className="text-2xl font-bold text-green-600">{(metadata.success_rate * 100).toFixed(1)}%</p>
          <p className="text-sm text-green-700">Data retrieval success</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Total Tickers</span>
            <span className="font-medium">{metadata.total_tickers}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Successful Tickers</span>
            <span className="font-medium">{metadata.successful_tickers}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Failed Tickers</span>
            <span className="font-medium">{metadata.failed_tickers}</span>
          </div>
          {metadata.cache_hit_rate && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Cache Hit Rate</span>
              <span className="font-medium">{(metadata.cache_hit_rate * 100).toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {metadata.failed_ticker_list && metadata.failed_ticker_list.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Failed Tickers</h3>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-red-800">
              {metadata.failed_ticker_list.join(', ')}
            </p>
            <p className="text-sm text-red-600 mt-2">
              These tickers could not be retrieved from any data source
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Dividends Tab Component
function DividendsTab({ dividendData }: { dividendData: any }) {
  if (!dividendData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No dividend data available</p>
      </div>
    )
  }

  // Calculate aggregate metrics
  let totalDividends = 0
  let totalCount = 0
  const tickerSummaries = Object.entries(dividendData).map(([ticker, data]: [string, any]) => {
    totalDividends += data.total_dividends || 0
    totalCount += data.dividend_count || 0
    return {
      ticker,
      totalDividends: data.total_dividends || 0,
      dividendCount: data.dividend_count || 0,
      dividends: data.dividends || []
    }
  })

  return (
    <div className="space-y-6">
      {/* Dividend Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Total Dividend Income</h3>
          <p className="text-2xl font-bold text-green-600">${totalDividends.toFixed(2)}</p>
          <p className="text-sm text-green-700">For selected period</p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Total Payments</h3>
          <p className="text-2xl font-bold text-blue-600">{totalCount}</p>
          <p className="text-sm text-blue-700">Dividend distributions</p>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900">Avg per Payment</h3>
          <p className="text-2xl font-bold text-purple-600">
            ${totalCount > 0 ? (totalDividends / totalCount).toFixed(2) : '0.00'}
          </p>
          <p className="text-sm text-purple-700">Across all tickers</p>
        </div>
      </div>

      {/* Dividend Overview by Ticker */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Dividend Summary by Ticker</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ticker
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Dividends
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg per Payment
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tickerSummaries.map((summary) => (
                <tr key={summary.ticker} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <TickerLink 
                      ticker={summary.ticker}
                      variant="default"
                      size="sm"
                      ariaLabel={`View ${summary.ticker} stock details and dividend history`}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${summary.totalDividends.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {summary.dividendCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${summary.dividendCount > 0 ? (summary.totalDividends / summary.dividendCount).toFixed(2) : '0.00'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Dividend History */}
      {tickerSummaries.some(s => s.dividends.length > 0) && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Dividend Payment History</h3>
            <p className="text-sm text-gray-600 mt-1">Individual dividend payments for all tickers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ticker
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ex-Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickerSummaries.flatMap(summary => 
                  summary.dividends.map((dividend: any, index: number) => (
                    <tr key={`${summary.ticker}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <TickerLink 
                          ticker={summary.ticker}
                          variant="default"
                          size="sm"
                          ariaLabel={`View ${summary.ticker} stock details and dividend history`}
                        />
                      </td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Dividends Message */}
      {tickerSummaries.every(s => s.dividendCount === 0) && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dividends Found</h3>
          <p className="text-gray-600">
            None of the analyzed tickers paid dividends in the selected time period, or they may not be dividend-paying securities.
          </p>
        </div>
      )}
    </div>
  )
}
