'use client'

/**
 * Example Integration Component
 * 
 * This demonstrates how Agent A (page structure) and Agent B (chart component) 
 * can integrate with Agent C's (this) time range selection and data fetching logic.
 */

import { useState, useEffect } from 'react'
import { TimeRangeSelector, CompactTimeRangeSelector } from './TimeRangeSelector'
import { useStockData } from '@/hooks/useStockData'
import { useUrlState } from '@/hooks/useUrlState'
import { TimeRange, StockDataResponse } from '@/types/stock'

// Example of how Agent A would structure the page
export function AgentAPageStructure({ symbol }: { symbol: string }) {
  const { timeRange, setTimeRange } = useUrlState(symbol)
  const { data, loading, error, fetchData } = useStockData()

  useEffect(() => {
    if (symbol) {
      fetchData([symbol], timeRange)
    }
  }, [symbol, timeRange, fetchData])

  return (
    <div className="space-y-6">
      {/* Agent A: Page Header and Layout */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">{symbol} Analysis</h1>
        
        {/* Agent C: Time Range Selection */}
        <TimeRangeSelector
          selectedRange={timeRange}
          onRangeChange={setTimeRange}
          disabled={loading}
        />
      </div>

      {/* Agent B: Chart Component Integration Point */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <AgentBChartIntegration 
          data={data}
          symbol={symbol}
          timeRange={timeRange}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  )
}

// Example of how Agent B would integrate with the data
interface AgentBChartIntegrationProps {
  data: StockDataResponse | null
  symbol: string
  timeRange: TimeRange
  loading: boolean
  error: string | null
}

function AgentBChartIntegration({ 
  data, 
  symbol, 
  timeRange, 
  loading, 
  error 
}: AgentBChartIntegrationProps) {
  const [chartType, setChartType] = useState<'line' | 'candlestick' | 'area'>('line')

  // Agent B would use this data to render their chart
  const chartData = data?.data[symbol]?.data || []
  
  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chart data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center text-red-600">
          <div className="text-4xl mb-2">⚠️</div>
          <p>Failed to load chart data</p>
          <p className="text-sm text-gray-600 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!data || chartData.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📈</div>
          <p>No chart data available</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Agent B: Chart Controls */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">{symbol} Price Chart</h2>
        <div className="flex items-center space-x-4">
          {/* Compact time range selector for chart header */}
          <CompactTimeRangeSelector
            selectedRange={timeRange}
            onRangeChange={() => {}} // Would be connected to parent
          />
          
          {/* Chart type selector */}
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as any)}
            className="px-3 py-1 text-sm border border-gray-300 rounded"
          >
            <option value="line">Line Chart</option>
            <option value="candlestick">Candlestick</option>
            <option value="area">Area Chart</option>
          </select>
        </div>
      </div>

      {/* Agent B: Chart Rendering Area */}
      <div className="h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-lg font-medium">Agent B Chart Component</div>
          <div className="text-sm text-gray-600 mt-2">
            {chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart for {symbol}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {chartData.length} data points • {timeRange} range
          </div>
          
          {/* Agent B would render actual chart here using libraries like:
              - Recharts
              - Chart.js
              - D3.js
              - TradingView Charting Library
              - etc.
          */}
          
          <div className="mt-4 text-xs text-gray-400">
            <div>Latest Close: ${chartData[chartData.length - 1]?.Close?.toFixed(2)}</div>
            <div>Date Range: {new Date(chartData[0]?.Date).toLocaleDateString()} - {new Date(chartData[chartData.length - 1]?.Date).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Example of a complete integration showing data flow
export function CompleteIntegrationExample() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">Complete Integration Example</h1>
          <p className="text-gray-600 mb-4">
            This demonstrates how all three agents (A, B, C) work together:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mb-4">
            <li><strong>Agent A:</strong> Page structure and layout</li>
            <li><strong>Agent B:</strong> Chart component integration</li>
            <li><strong>Agent C:</strong> Time range selection and data fetching</li>
          </ul>
          
          {/* Symbol selector */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Symbol:</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="AAPL">Apple (AAPL)</option>
              <option value="MSFT">Microsoft (MSFT)</option>
              <option value="GOOGL">Google (GOOGL)</option>
              <option value="SPY">SPDR S&P 500 ETF (SPY)</option>
              <option value="QQQ">Invesco QQQ Trust (QQQ)</option>
            </select>
          </div>
        </div>

        <AgentAPageStructure symbol={selectedSymbol} />
      </div>
    </div>
  )
}