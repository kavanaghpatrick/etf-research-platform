'use client'

import { useMemo, useState, useCallback, memo } from 'react'
import { ResponsiveLine } from '@nivo/line'
import {
  transformMultipleTickersToNivoNormalized,
  formatChartDate,
  downsampleData,
  ApiTickerData,
} from './chartUtils'

export interface NormalizedMultiTickerChartProps {
  tickersData: Record<string, { data: ApiTickerData[] }>
  height?: string | number
  loading?: boolean
  error?: string
  showGrid?: boolean
  enableCrosshair?: boolean
  maxDataPoints?: number
  priceField?: 'Open' | 'High' | 'Low' | 'Close'
  className?: string
}

const CHART_COLORS = [
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
]

const CHART_THEME = {
  background: 'transparent',
  text: {
    fontSize: 12,
    fill: '#374151',
  },
  axis: {
    domain: {
      line: {
        stroke: '#e5e7eb',
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: '#374151',
        fontWeight: 500,
      },
    },
    ticks: {
      line: {
        stroke: '#e5e7eb',
        strokeWidth: 1,
      },
      text: {
        fontSize: 11,
        fill: '#6b7280',
      },
    },
  },
  grid: {
    line: {
      stroke: '#f3f4f6',
      strokeWidth: 1,
    },
  },
  crosshair: {
    line: {
      stroke: '#6b7280',
      strokeWidth: 1,
      strokeDasharray: '4 4',
    },
  },
  tooltip: {
    container: {
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      fontSize: '12px',
      padding: '12px',
    },
  },
} as const

const LoadingState = memo(function LoadingState({ height }: { height: string | number }) {
  const heightStyle = typeof height === 'string' ? height : `${height}px`
  return (
    <div 
      className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
      style={{ height: heightStyle }}
    >
      <div className="flex flex-col items-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-sm text-gray-500">Loading chart data...</p>
      </div>
    </div>
  )
})

const ErrorState = memo(function ErrorState({ error, height }: { error: string; height: string | number }) {
  const heightStyle = typeof height === 'string' ? height : `${height}px`
  return (
    <div 
      className="flex items-center justify-center bg-red-50 rounded-lg border border-red-200"
      style={{ height: heightStyle }}
    >
      <div className="flex flex-col items-center space-y-3 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-red-500 text-xl">⚠️</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-800">Chart Error</h3>
          <p className="text-xs text-red-600 mt-1">{error}</p>
        </div>
      </div>
    </div>
  )
})

const EmptyState = memo(function EmptyState({ height }: { height: string | number }) {
  const heightStyle = typeof height === 'string' ? height : `${height}px`
  return (
    <div 
      className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200"
      style={{ height: heightStyle }}
    >
      <div className="flex flex-col items-center space-y-3 p-6 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
          <span className="text-gray-400 text-xl">📈</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-gray-600">No Data Available</h3>
          <p className="text-xs text-gray-500 mt-1">No chart data to display</p>
        </div>
      </div>
    </div>
  )
})

const NormalizedMultiTickerChartComponent = function NormalizedMultiTickerChart({
  tickersData,
  height = '400px',
  loading = false,
  error,
  showGrid = true,
  enableCrosshair = true,
  maxDataPoints = 500,
  priceField = 'Close',
  className = '',
}: NormalizedMultiTickerChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<any>(null)

  const chartHeightMemo = useMemo(() => typeof height === 'string' ? height : `${height}px`, [height])
  const totalDataPoints = useMemo(() => Object.values(tickersData || {}).reduce(
    (total, data) => total + data.data.length, 
    0
  ), [tickersData])

  const handleMouseMove = useCallback((point: Record<string, unknown>) => {
    if (point) {
      setHoveredPoint(point)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null)
  }, [])

  const tooltipHandler = useCallback(({ point }: { point: Record<string, unknown> }) => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <div className="text-sm font-medium text-gray-900">
          {point.serieId}
        </div>
        <div className="text-sm text-gray-600">
          {new Date(point.data.x).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
        <div className="text-sm font-semibold" style={{ color: point.serieColor }}>
          {(point.data.y as number).toFixed(2)}%
        </div>
      </div>
    )
  }, [])

  // Create a stable data key to prevent unnecessary re-renders
  const dataKey = useMemo(() => {
    if (!tickersData) return 'empty'
    const tickers = Object.keys(tickersData).sort()
    const dataPoints = Object.values(tickersData).reduce((sum, ticker) => sum + ticker.data.length, 0)
    return `${tickers.join('-')}-${dataPoints}-${priceField}`
  }, [tickersData, priceField])

  const chartData = useMemo(() => {
    if (!tickersData || Object.keys(tickersData).length === 0) {
      return []
    }

    // Downsample data for each ticker individually
    const processedData: Record<string, { data: ApiTickerData[] }> = {}
    Object.entries(tickersData).forEach(([ticker, data]) => {
      processedData[ticker] = {
        data: downsampleData(data.data, maxDataPoints),
      }
    })

    return transformMultipleTickersToNivoNormalized(processedData, priceField)
  }, [tickersData, maxDataPoints, priceField])

  if (loading) {
    return <LoadingState height={height} />
  }

  if (error) {
    return <ErrorState error={error} height={height} />
  }

  if (!chartData || chartData.length === 0) {
    return <EmptyState height={height} />
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Chart Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Performance Comparison</h3>
            <p className="text-sm text-gray-600">
              Relative performance (% change from start)
            </p>
          </div>
          
          {hoveredPoint && (
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {hoveredPoint.serieId}
              </div>
              <div className="text-sm font-semibold" style={{ color: hoveredPoint.color }}>
                {hoveredPoint.y.toFixed(2)}%
              </div>
              <div className="text-xs text-gray-500">
                {new Date(hoveredPoint.x).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3">
          {chartData.map((series, index) => (
            <div key={series.id} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-xs text-gray-600">{series.id}</span>
              {/* Show final percentage change */}
              {series.data.length > 0 && (
                <span className={`text-xs font-medium ${
                  series.data[series.data.length - 1].y >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ({series.data[series.data.length - 1].y >= 0 ? '+' : ''}{series.data[series.data.length - 1].y.toFixed(1)}%)
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ height: chartHeightMemo }}>
        <ResponsiveLine
          key={dataKey}
          data={chartData}
          theme={CHART_THEME}
          margin={{ top: 20, right: 50, bottom: 50, left: 60 }}
          xScale={{
            type: 'time',
            format: 'native',
          }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto',
            stacked: false,
          }}
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value: Date) => formatChartDate(value, totalDataPoints),
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value: number) => `${value.toFixed(0)}%`,
            legend: 'Change %',
            legendOffset: -45,
            legendPosition: 'middle',
          }}
          colors={CHART_COLORS}
          pointSize={0}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={0}
          pointBorderColor={{ from: 'serieColor' }}
          enablePointLabel={false}
          useMesh={true}
          enableSlices="x"
          enableGridX={showGrid}
          enableGridY={showGrid}
          enableCrosshair={enableCrosshair}
          crosshairType="cross"
          animate={false}
          motionConfig="gentle"
          lineWidth={2}
          enableArea={false}
          tooltip={tooltipHandler}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          // Add zero line
          markers={[
            {
              axis: 'y',
              value: 0,
              lineStyle: { stroke: '#9ca3af', strokeWidth: 1, strokeDasharray: '3 3' },
            },
          ]}
        />
      </div>
    </div>
  )
}

export const NormalizedMultiTickerChart = memo(NormalizedMultiTickerChartComponent)
NormalizedMultiTickerChart.displayName = 'NormalizedMultiTickerChart'