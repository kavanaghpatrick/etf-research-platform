'use client'

import { useState } from 'react'
import { StockChart, MultiTickerChart } from './StockChart'
import { ChartIntegrationExample, MiniChart } from './ChartIntegrationExample'
import { TickerLink, TickerBadge } from './TickerLink'

interface ResultsDashboardProps {
  results: any
  onNewAnalysis: () => void
}

export function ResultsDashboardWithCharts({ results, onNewAnalysis }: ResultsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')

  if (!results) return null

  const { data, metadata, source_health, dividend_data } = results

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'data', label: 'Data', icon: '📈' },
    { id: 'charts', label: 'Charts', icon: '📉' }, // Add charts tab
    ...(dividend_data ? [{ id: 'dividends', label: 'Dividends', icon: '💰' }] : []),
    { id: 'sources', label: 'Sources', icon: '🔗' },
    { id: 'performance', label: 'Performance', icon: '⚡' }
  ]

  return (
    <div className="space-y-6">
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
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
              <div className="w-full bg-gray-200 rounded-full h-2">
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
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTabWithCharts data={data} metadata={metadata} dividendData={dividend_data} onSwitchToDividends={() => setActiveTab('dividends')} />
          )}
          {activeTab === 'data' && (
            <DataTab data={data} />
          )}
          {activeTab === 'charts' && (
            <ChartIntegrationExample data={data} />
          )}
          {activeTab === 'dividends' && dividend_data && (
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

// Enhanced Overview Tab with Mini Charts
function OverviewTabWithCharts({ data, metadata, dividendData, onSwitchToDividends }: { 
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

      {/* Quick Charts Section */}
      {tickers.length > 1 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Portfolio Overview Chart</h3>
          <MultiTickerChart
            tickersData={data}
            height="300px"
            chartType="line"
            maxDataPoints={100}
            showGrid={false}
          />
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Ticker Summary with Charts</h3>
        <div className="grid gap-6">
          {tickers.map((ticker) => {
            const tickerData = data[ticker]
            return (
              <div key={ticker} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Ticker Info */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
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
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Date Range</p>
                        <p className="text-sm font-medium">
                          {new Date(tickerData.date_range.start).toLocaleDateString()} - {new Date(tickerData.date_range.end).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {/* Price Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Latest Price</p>
                        <p className="font-semibold text-lg">
                          ${tickerData.data[tickerData.data.length - 1]?.Close?.toFixed(2) || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Price Change</p>
                        <p className="font-semibold text-lg">
                          {(() => {
                            const first = tickerData.data[0]?.Close || 0
                            const last = tickerData.data[tickerData.data.length - 1]?.Close || 0
                            const change = ((last - first) / first * 100)
                            return (
                              <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                              </span>
                            )
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mini Chart */}
                  <div>
                    <MiniChart 
                      data={tickerData.data} 
                      ticker={ticker} 
                      height="200px" 
                    />
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

// Copy the remaining tab components from the original ResultsDashboard
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

      {/* Rest of dividends tab content... */}
    </div>
  )
}