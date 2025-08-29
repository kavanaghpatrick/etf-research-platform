'use client'

import { useState } from 'react'
import { StockChart, MultiTickerChart } from './StockChart'
import { ApiTickerData } from './chartUtils'

interface ChartIntegrationExampleProps {
  data: Record<string, { data: ApiTickerData[] }>
}

/**
 * Example component showing how to integrate StockChart with existing dashboard data
 * This demonstrates the integration pattern for Agent A to follow
 */
export function ChartIntegrationExample({ data }: ChartIntegrationExampleProps) {
  const [selectedTicker, setSelectedTicker] = useState<string>(Object.keys(data)[0] || '')
  const [chartType, setChartType] = useState<'line' | 'area'>('line')
  const [priceField, setPriceField] = useState<'Open' | 'High' | 'Low' | 'Close'>('Close')
  const [viewMode, setViewMode] = useState<'single' | 'comparison'>('single')

  const tickers = Object.keys(data)

  if (tickers.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No chart data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* View Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View Mode
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'single' | 'comparison')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="single">Single Ticker</option>
              <option value="comparison">Compare All</option>
            </select>
          </div>

          {/* Ticker Selection (only for single view) */}
          {viewMode === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Ticker
              </label>
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                {tickers.map((ticker) => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            </div>
          )}

          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chart Type
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'line' | 'area')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="line">Line Chart</option>
              <option value="area">Area Chart</option>
            </select>
          </div>

          {/* Price Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Field
            </label>
            <select
              value={priceField}
              onChange={(e) => setPriceField(e.target.value as 'Open' | 'High' | 'Low' | 'Close')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="Close">Close Price</option>
              <option value="Open">Open Price</option>
              <option value="High">High Price</option>
              <option value="Low">Low Price</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      {viewMode === 'single' && selectedTicker && data[selectedTicker] ? (
        <StockChart
          data={data[selectedTicker].data}
          ticker={selectedTicker}
          height="500px"
          chartType={chartType}
          priceField={priceField}
          showGrid={true}
          enableCrosshair={true}
          maxDataPoints={500}
        />
      ) : viewMode === 'comparison' ? (
        <MultiTickerChart
          tickersData={data}
          height="500px"
          chartType={chartType}
          priceField={priceField}
          showGrid={true}
          enableCrosshair={true}
          maxDataPoints={300} // Lower for comparison charts
        />
      ) : null}

      {/* Data Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Chart Data Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Tickers:</span>
            <span className="ml-2 font-medium">{tickers.length}</span>
          </div>
          <div>
            <span className="text-gray-600">Data Points:</span>
            <span className="ml-2 font-medium">
              {Object.values(data).reduce((total, ticker) => total + ticker.data.length, 0)}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Current Mode:</span>
            <span className="ml-2 font-medium capitalize">{viewMode}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Integration helper function for ResultsDashboard
 * Add this as a new tab in the existing dashboard
 */
export function ChartTab({ data }: { data: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Price Charts</h3>
        <p className="text-sm text-gray-600 mb-6">
          Interactive charts showing price movements and comparisons across tickers.
        </p>
      </div>
      
      <ChartIntegrationExample data={data} />
    </div>
  )
}

/**
 * Simple integration example for a single ticker in overview
 * Can be embedded directly in overview cards
 */
export function MiniChart({ 
  data, 
  ticker, 
  height = '200px' 
}: { 
  data: ApiTickerData[]; 
  ticker: string; 
  height?: string 
}) {
  return (
    <div className="w-full">
      <StockChart
        data={data}
        ticker={ticker}
        height={height}
        chartType="area"
        showGrid={false}
        enableCrosshair={false}
        maxDataPoints={100}
      />
    </div>
  )
}

// Export everything for easy imports
export { StockChart, MultiTickerChart } from './StockChart'
export * from './chartUtils'