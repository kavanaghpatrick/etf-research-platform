'use client'

import React, { useMemo, useState, useEffect, useCallback, memo } from 'react'
import { ResponsiveLine } from '@nivo/line'
import {
  transformToNivoFormat,
  transformMultipleTickersToNivo,
  formatPrice,
  formatChartDate,
  calculatePriceChange,
  getDataRange,
  downsampleData,
  ApiTickerData,
} from './chartUtils'
import { DividendOverlayOptions, TimeRange } from '@/types/stock'
import { useDividendDataWithPrices } from '@/hooks/useDividendData'

// Types for chart interactions
interface HoveredPoint {
  x: Date | string | number
  y: number
  serieId: string
  serieColor: string
  color?: string
}

// Custom layer props for dividend markers
interface DividendLayerProps {
  points: Array<{
    x: number
    y: number
    datum: {
      x: Date | string | number
      y: number
    }
  }>
  xScale: any
  yScale: any
  innerWidth?: number
  innerHeight?: number
  margin?: { top: number; right: number; bottom: number; left: number }
  dividendData?: {
    markers: Array<{
      date: string
      amount: number
      x: Date
      y: number
    }>
  }
  markerColor?: string
  markerSize?: number
}

export interface StockChartProps {
  data: ApiTickerData[]
  ticker?: string
  height?: string | number
  chartType?: 'line' | 'area'
  loading?: boolean
  error?: string
  showGrid?: boolean
  enableCrosshair?: boolean
  maxDataPoints?: number
  priceField?: 'Open' | 'High' | 'Low' | 'Close'
  className?: string
  // Dividend overlay props
  dividendOverlay?: DividendOverlayOptions
  timeRange?: TimeRange
  customStartDate?: string
  customEndDate?: string
}

export interface MultiTickerChartProps {
  tickersData: Record<string, { data: ApiTickerData[] }>
  height?: string | number
  chartType?: 'line' | 'area'
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

const DIVIDEND_MARKER_COLOR = '#dc2626' // red-600

// Custom layer component for dividend markers
const DividendLayer = ({
  points,
  xScale,
  yScale,
  innerWidth,
  innerHeight,
  margin,
  dividendData,
  markerColor = DIVIDEND_MARKER_COLOR,
  markerSize = 8,
}: DividendLayerProps) => {
  // Early return if no data
  if (!dividendData?.markers || dividendData.markers.length === 0) {
    return null
  }

  // Ensure scales are functions (Nivo sometimes passes different scale types)
  if (typeof xScale !== 'function' || typeof yScale !== 'function') {
    console.log('[DividendLayer] Scales not ready:', { xScale: typeof xScale, yScale: typeof yScale })
    return null
  }

  console.log('[DividendLayer] Rendering dividend markers:', {
    markersCount: dividendData.markers.length,
    pointsCount: points?.length || 0,
    firstMarker: dividendData.markers[0],
    scaleTypes: { x: typeof xScale, y: typeof yScale },
    chartBounds: { innerWidth, innerHeight, margin }
  })

  // Pre-compute all marker positions with bounds checking
  const validMarkers = dividendData.markers.map((marker, index) => {
    try {
      const rawX = xScale(marker.x)
      const rawY = yScale(marker.y)
      
      // Validate raw coordinates
      if (typeof rawX !== 'number' || typeof rawY !== 'number' || 
          isNaN(rawX) || isNaN(rawY) || 
          !isFinite(rawX) || !isFinite(rawY)) {
        return null
      }

      // Apply bounds checking to keep markers within chart plotting area
      // Chart plotting area is from (0, 0) to (innerWidth, innerHeight)
      // But we need to account for margin to avoid Y-axis overlap
      const minX = 0 // Left edge of plotting area
      const maxX = (innerWidth || 0) // Right edge of plotting area
      const minY = 0 // Top edge of plotting area  
      const maxY = (innerHeight || 0) // Bottom edge of plotting area
      
      // Clamp coordinates to stay within chart bounds
      const x = Math.max(minX + markerSize, Math.min(maxX - markerSize, rawX))
      const y = Math.max(minY + markerSize, Math.min(maxY - markerSize, rawY))
      
      // Only render if the marker would be visible within reasonable bounds
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        return { marker, x, y, index, wasClampedX: x !== rawX, wasClampedY: y !== rawY }
      }
      
      return null
    } catch (error) {
      console.error('[DividendLayer] Error calculating marker position:', error, marker)
      return null
    }
  }).filter(Boolean)

  console.log('[DividendLayer] Valid markers calculated:', {
    total: dividendData.markers.length,
    valid: validMarkers.length,
    clampedCount: validMarkers.filter(m => m.wasClampedX || m.wasClampedY).length
  })

  return (
    <g className="dividend-markers" style={{ pointerEvents: 'none' }}>
      {validMarkers.map((markerData) => (
        <g key={`dividend-${markerData.index}`} transform={`translate(${markerData.x}, ${markerData.y})`}>
          <circle
            r={markerSize}
            fill={markerColor}
            stroke="#ffffff"
            strokeWidth={2}
            opacity={markerData.wasClampedX || markerData.wasClampedY ? 0.7 : 1}
          />
          <title>
            Dividend: ${markerData.marker.amount.toFixed(2)}
            {markerData.wasClampedX || markerData.wasClampedY ? ' (position adjusted to stay within chart)' : ''}
          </title>
        </g>
      ))}
    </g>
  )
}

// Extract chart theme outside component to prevent recreation on every render
const CHART_THEME = {
  background: 'transparent',
  text: {
    fontSize: 12,
    fill: '#374151', // gray-700
  },
  axis: {
    domain: {
      line: {
        stroke: '#e5e7eb', // gray-200
        strokeWidth: 1,
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: '#374151', // gray-700
        fontWeight: 500,
      },
    },
    ticks: {
      line: {
        stroke: '#e5e7eb', // gray-200
        strokeWidth: 1,
      },
      text: {
        fontSize: 11,
        fill: '#6b7280', // gray-500
      },
    },
  },
  grid: {
    line: {
      stroke: '#f3f4f6', // gray-100
      strokeWidth: 1,
    },
  },
  crosshair: {
    line: {
      stroke: '#6b7280', // gray-500
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
      fontSize: '14px',
      padding: '0px',
      zIndex: 9999,
      minHeight: 'auto',
      maxHeight: 'none',
      overflow: 'visible',
      minWidth: '180px',
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


const StockChartComponent = function StockChart({
  data,
  ticker = 'Stock',
  height = '70vh',
  chartType = 'line',
  loading = false,
  error,
  showGrid = true,
  enableCrosshair = true,
  maxDataPoints = 500,
  priceField = 'Close',
  className = '',
  dividendOverlay,
  timeRange,
  customStartDate,
  customEndDate,
}: StockChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null)
  
  // Initialize dividend hook
  const { 
    dividendData, 
    loading: dividendLoading, 
    error: dividendError,
    fetchDividendData,
    updateMarkersWithPrices,
    clearCache
  } = useDividendDataWithPrices(data)

  // Effect to fetch dividend data when ticker or time range changes
  useEffect(() => {
    // Always fetch dividend data when time range changes
    if (ticker && ticker !== 'Stock') {
      console.log('[StockChart] Time range changed, clearing cache and fetching fresh dividend data for:', ticker, {
        timeRange,
        customStartDate,
        customEndDate
      })
      // Clear cache to ensure fresh dividend data for new time range
      clearCache()
      fetchDividendData(ticker, timeRange, customStartDate, customEndDate)
    }
  }, [ticker, timeRange, customStartDate, customEndDate, fetchDividendData, clearCache])

  // Effect to update dividend markers when price data changes
  useEffect(() => {
    if (dividendData && data && data.length > 0) {
      console.log('[StockChart] Dividend data available:', dividendData)
      console.log('[StockChart] Calling updateMarkersWithPrices with', data.length, 'price points')
      updateMarkersWithPrices(data)
    }
  }, [data, dividendData, updateMarkersWithPrices])

  // Track when dividend markers should be visible
  const [dividendMarkersReady, setDividendMarkersReady] = useState(false)
  useEffect(() => {
    if (dividendData?.markers && dividendData.markers.length > 0) {
      // Set ready immediately - the layer will handle scale validation
      setDividendMarkersReady(true)
    } else {
      setDividendMarkersReady(false)
    }
  }, [dividendData?.markers])


  // Extract unique dates from the data for x-axis ticks (fixes duplicate date issue)
  const uniqueDates = useMemo(() => {
    if (!data || data.length === 0) return []
    const dateStrings = new Set(data.map(d => new Date(d.Date).toDateString()))
    return Array.from(dateStrings).map(dateString => new Date(dateString)).sort((a, b) => a.getTime() - b.getTime())
  }, [data])

  // Smart tick selection for readable x-axis labels
  const smartTickValues = useMemo(() => {
    if (!uniqueDates || uniqueDates.length === 0) return []
    
    const dataLength = uniqueDates.length
    let maxTicks: number
    
    // Determine optimal number of ticks based on data length and readability
    if (dataLength <= 7) {
      maxTicks = dataLength // Show all for week or less
    } else if (dataLength <= 30) {
      maxTicks = Math.min(7, dataLength) // Max 7 ticks for month
    } else if (dataLength <= 90) {
      maxTicks = 6 // Max 6 ticks for quarter
    } else if (dataLength <= 365) {
      maxTicks = 8 // Max 8 ticks for year
    } else {
      maxTicks = 8 // Increased for better multi-year coverage
    }
    
    // If we need to reduce ticks, use smart selection for multi-year ranges
    if (dataLength <= maxTicks) {
      return uniqueDates
    }
    
    // For multi-year data (2+ years), ensure we get good year distribution
    if (dataLength > 550) {
      const selectedDates = []
      const firstDate = uniqueDates[0]
      const lastDate = uniqueDates[uniqueDates.length - 1]
      const yearSpan = lastDate.getFullYear() - firstDate.getFullYear()
      
      // Always include first date
      selectedDates.push(firstDate)
      
      if (yearSpan > 1) {
        // For multi-year spans, try to get one tick per year
        const yearsToShow = Math.min(maxTicks - 2, yearSpan + 1) // Reserve spots for first/last
        const yearStep = Math.max(1, Math.floor(yearSpan / (yearsToShow - 1)))
        
        for (let i = 1; i < yearsToShow; i++) {
          const targetYear = firstDate.getFullYear() + (i * yearStep)
          // Find a date close to January of the target year
          const targetDate = uniqueDates.find(date => 
            date.getFullYear() === targetYear && date.getMonth() <= 2 // Jan-Mar
          ) || uniqueDates.find(date => date.getFullYear() === targetYear)
          
          if (targetDate && !selectedDates.find(d => d.getTime() === targetDate.getTime())) {
            selectedDates.push(targetDate)
          }
        }
      } else {
        // Single year or less, use regular spacing
        const step = Math.floor(dataLength / (maxTicks - 1))
        for (let i = 1; i < maxTicks - 1; i++) {
          const index = i * step
          if (index < uniqueDates.length) {
            selectedDates.push(uniqueDates[index])
          }
        }
      }
      
      // Always include last date if different from the last selected
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates.sort((a, b) => a.getTime() - b.getTime())
    } else if (dataLength > 90) {
      // For 3M-1.5Y ranges, use month-based selection to avoid duplicates
      const selectedDates = []
      const firstDate = uniqueDates[0]
      const lastDate = uniqueDates[uniqueDates.length - 1]
      
      // Always include first date
      selectedDates.push(firstDate)
      
      // Try to get roughly monthly intervals
      const monthsSpan = ((lastDate.getFullYear() - firstDate.getFullYear()) * 12) + 
                        (lastDate.getMonth() - firstDate.getMonth())
      
      if (monthsSpan > 1) {
        const monthStep = Math.max(1, Math.floor(monthsSpan / (maxTicks - 2)))
        
        for (let i = 1; i < maxTicks - 1; i++) {
          const targetMonths = i * monthStep
          const targetDate = new Date(firstDate)
          targetDate.setMonth(targetDate.getMonth() + targetMonths)
          
          // Find closest actual date to our target
          const closestDate = uniqueDates.reduce((closest, date) => {
            const dateDiff = Math.abs(date.getTime() - targetDate.getTime())
            const closestDiff = Math.abs(closest.getTime() - targetDate.getTime())
            return dateDiff < closestDiff ? date : closest
          })
          
          if (!selectedDates.find(d => d.getTime() === closestDate.getTime())) {
            selectedDates.push(closestDate)
          }
        }
      }
      
      // Always include last date if different from the last selected
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates.sort((a, b) => a.getTime() - b.getTime())
    } else {
      // Regular spacing for shorter ranges
      const step = Math.floor(dataLength / (maxTicks - 1))
      const selectedDates = []
      
      // Always include first date
      selectedDates.push(uniqueDates[0])
      
      // Add evenly spaced dates
      for (let i = 1; i < maxTicks - 1; i++) {
        const index = i * step
        if (index < uniqueDates.length) {
          selectedDates.push(uniqueDates[index])
        }
      }
      
      // Always include last date if we have room and it's different from the last selected
      const lastDate = uniqueDates[uniqueDates.length - 1]
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates
    }
  }, [uniqueDates])

  // Memoize expensive calculations that don't need to recalculate on every render
  const areaOpacity = useMemo(() => chartType === 'area' ? 0.15 : 0, [chartType])
  const chartHeightMemo = useMemo(() => typeof height === 'string' ? height : `${height}px`, [height])

  // Memoize slice tooltip handler for Nivo's enableSlices="x" mode
  const tooltipHandler = useCallback(({ slice }: { slice: { points: Array<{ serieId: string, serieColor: string, data: { x: any, y: number } }> } }) => {
    if (!slice?.points || slice.points.length === 0) return null
    
    // Get the first point for the date (all points in a slice share the same x value)
    const firstPoint = slice.points[0]
    const xValue = firstPoint.data.x
    let formattedDate = 'Unknown Date'
    let pointDate = ''
    
    // Validate and format date with proper error handling
    if (xValue) {
      try {
        const date = new Date(xValue)
        if (!isNaN(date.getTime())) {
          formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          pointDate = date.toISOString().split('T')[0]
        } else {
          console.warn('[Tooltip] Invalid date:', xValue)
        }
      } catch (error) {
        console.error('[Tooltip] Date parsing error:', error, xValue)
      }
    }
    
    const dividendOnDate = dividendData?.dividends.find(
      div => div.ex_date === pointDate
    )
    
    console.log('[Slice Tooltip Debug]', {
      pointsCount: slice.points.length,
      firstPoint: firstPoint.serieId,
      price: firstPoint.data.y,
      rawX: xValue,
      formattedDate,
      hasDividend: !!dividendOnDate
    })
    
    return (
      <div 
        className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[180px]" 
        style={{ 
          zIndex: 9999, 
          minHeight: '80px', 
          overflow: 'visible',
          maxHeight: 'none'
        }}
      >
        {slice.points.map((point, index) => (
          <div key={`${point.serieId}-${index}`} className={index > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}>
            <div className="text-sm font-medium text-gray-900 mb-1">
              {point.serieId}
            </div>
            <div className="text-lg font-bold mb-2" style={{ color: point.serieColor }}>
              ${(point.data.y as number).toFixed(2)}
            </div>
          </div>
        ))}
        <div 
          className="text-sm font-medium text-gray-700 mb-1 mt-2 pt-2 border-t border-gray-100" 
          data-testid="tooltip-date"
          style={{ display: 'block', visibility: 'visible' }}
        >
          {formattedDate}
        </div>
        {dividendOnDate && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="text-xs text-red-600 font-medium">
              Dividend: ${dividendOnDate.dividend_amount.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500">
              Ex-Date: {dividendOnDate.ex_date}
            </div>
          </div>
        )}
      </div>
    )
  }, [dividendData?.dividends])

  // Memoize mouse event handlers to prevent recreation
  const handleMouseMove = useCallback((point: Record<string, unknown>) => {
    if (point) {
      setHoveredPoint(point as HoveredPoint)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null)
  }, [])

  const { chartData, priceChange, dataRange } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], priceChange: null, dataRange: null }
    }

    // Filter data based on time range
    let filteredData = data
    if (timeRange && timeRange !== 'MAX') {
      const endDate = customEndDate || new Date().toISOString().split('T')[0]
      let startDate = customStartDate
      
      if (!startDate) {
        const today = new Date()
        const config = [
          { value: '1D', days: 1 },
          { value: '5D', days: 5 },
          { value: '1M', days: 30 },
          { value: '3M', days: 90 },
          { value: '6M', days: 180 },
          { value: '1Y', days: 365 },
          { value: '5Y', days: 1825 }
        ].find(c => c.value === timeRange)
        
        if (config) {
          const start = new Date(today)
          start.setDate(start.getDate() - config.days)
          startDate = start.toISOString().split('T')[0]
        }
      }
      
      if (startDate) {
        filteredData = data.filter(item => {
          const itemDate = item.Date.split('T')[0] // Handle both date and datetime formats
          return itemDate >= startDate && itemDate <= endDate
        })
      }
    }

    const processedData = downsampleData(filteredData, maxDataPoints)
    const nivoData = transformToNivoFormat(processedData, priceField, ticker)
    const change = calculatePriceChange(processedData)
    const range = getDataRange(processedData)

    console.log('[StockChart] Chart data prepared:', {
      hasDividendData: !!dividendData,
      markersCount: dividendData?.markers?.length || 0,
      dataRange: range,
    })

    return {
      chartData: nivoData,
      priceChange: change,
      dataRange: range,
    }
  }, [data, ticker, maxDataPoints, priceField, timeRange, customStartDate, customEndDate])

  if (loading) {
    return <LoadingState height={height} />
  }

  if (error) {
    return <ErrorState error={error} height={height} />
  }

  if (!chartData || chartData.length === 0 || chartData[0]?.data.length === 0) {
    return <EmptyState height={height} />
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Chart Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{ticker}</h3>
            {priceChange && (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-sm text-gray-600">
                  {formatPrice(dataRange?.maxPrice || 0)}
                </span>
                <span
                  className={`text-sm font-medium ${
                    priceChange.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {priceChange.isPositive ? '+' : ''}{formatPrice(priceChange.change)} 
                  ({priceChange.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {hoveredPoint && (
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {formatPrice(hoveredPoint.y)}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(hoveredPoint.x).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Dividend Status */}
        {dividendLoading && (
          <div className="mt-2 text-xs text-gray-500">
            Loading dividend data...
          </div>
        )}
        {dividendError && (
          <div className="mt-2 text-xs text-red-600">
            {dividendError}
          </div>
        )}
        {dividendData && dividendData.count > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            Showing {dividendData.count} dividend{dividendData.count !== 1 ? 's' : ''} 
            (Total: {formatPrice(dividendData.total)}) - Markers: {dividendData.markers?.length || 0}
          </div>
        )}
      </div>

      {/* Chart Container */}
      <div style={{ height: chartHeightMemo, overflow: 'visible' }}>
        <ResponsiveLine
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
            tickValues: smartTickValues, // Use smart tick selection for readability
            format: (value: Date) => formatChartDate(value, data?.length || 0),
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value: number) => formatPrice(value),
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
          animate={data && data.length > 200 ? false : true}
          motionConfig="gentle"
          lineWidth={2}
          enableArea={chartType === 'area'}
          areaOpacity={areaOpacity}
          areaBaselineValue="auto"
          defs={chartType === 'area' ? [
            {
              id: 'gradientA',
              type: 'linearGradient',
              colors: [
                { offset: 0, color: 'inherit' },
                { offset: 100, color: 'inherit', opacity: 0 },
              ],
            },
          ] : []}
          fill={chartType === 'area' ? [
            { match: '*', id: 'gradientA' },
          ] : []}
          layers={[
            'grid',
            'axes', 
            'areas',
            'lines',
            'points',
            'crosshair',
            'slices',
            'mesh',
            // Custom dividend layer - render after mesh to ensure chart is ready
            (props: any) => (
              <DividendLayer
                {...props}
                dividendData={dividendMarkersReady ? dividendData : undefined}
                markerColor={dividendOverlay?.markerColor}
                markerSize={dividendOverlay?.markerSize}
              />
            ),
            'legends',
          ]}
          sliceTooltip={tooltipHandler}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  )
}

// Export memoized StockChart for performance optimization
export const StockChart = memo(StockChartComponent)
StockChart.displayName = 'StockChart'

const MultiTickerChartComponent = function MultiTickerChart({
  tickersData,
  height = '70vh',
  chartType = 'line',
  loading = false,
  error,
  showGrid = true,
  enableCrosshair = true,
  maxDataPoints = 500,
  priceField = 'Close',
  className = '',
}: MultiTickerChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null)
  
  // Memoize expensive calculations for MultiTickerChart
  const areaOpacity = useMemo(() => chartType === 'area' ? 0.15 : 0, [chartType])
  const chartHeightMemo = useMemo(() => typeof height === 'string' ? height : `${height}px`, [height])
  const totalDataPoints = useMemo(() => Object.values(tickersData || {}).reduce(
    (total, data) => total + data.data.length, 
    0
  ), [tickersData])

  // Extract unique dates for multi-ticker chart
  const uniqueDatesMulti = useMemo(() => {
    if (!tickersData) return []
    const allDates = new Set<string>()
    Object.values(tickersData).forEach(tickerData => {
      tickerData.data.forEach(point => {
        allDates.add(new Date(point.Date).toDateString())
      })
    })
    return Array.from(allDates).map(dateString => new Date(dateString)).sort((a, b) => a.getTime() - b.getTime())
  }, [tickersData])

  // Smart tick selection for multi-ticker chart
  const smartTickValuesMulti = useMemo(() => {
    if (!uniqueDatesMulti || uniqueDatesMulti.length === 0) return []
    
    const dataLength = uniqueDatesMulti.length
    let maxTicks: number
    
    // Same logic as single ticker chart
    if (dataLength <= 7) {
      maxTicks = dataLength
    } else if (dataLength <= 30) {
      maxTicks = Math.min(7, dataLength)
    } else if (dataLength <= 90) {
      maxTicks = 6
    } else if (dataLength <= 365) {
      maxTicks = 8
    } else {
      maxTicks = 8 // Increased for better multi-year coverage
    }
    
    if (dataLength <= maxTicks) {
      return uniqueDatesMulti
    }
    
    // For multi-year data (2+ years), ensure we get good year distribution
    if (dataLength > 550) {
      const selectedDates = []
      const firstDate = uniqueDatesMulti[0]
      const lastDate = uniqueDatesMulti[uniqueDatesMulti.length - 1]
      const yearSpan = lastDate.getFullYear() - firstDate.getFullYear()
      
      // Always include first date
      selectedDates.push(firstDate)
      
      if (yearSpan > 1) {
        // For multi-year spans, try to get one tick per year
        const yearsToShow = Math.min(maxTicks - 2, yearSpan + 1) // Reserve spots for first/last
        const yearStep = Math.max(1, Math.floor(yearSpan / (yearsToShow - 1)))
        
        for (let i = 1; i < yearsToShow; i++) {
          const targetYear = firstDate.getFullYear() + (i * yearStep)
          // Find a date close to January of the target year
          const targetDate = uniqueDatesMulti.find(date => 
            date.getFullYear() === targetYear && date.getMonth() <= 2 // Jan-Mar
          ) || uniqueDatesMulti.find(date => date.getFullYear() === targetYear)
          
          if (targetDate && !selectedDates.find(d => d.getTime() === targetDate.getTime())) {
            selectedDates.push(targetDate)
          }
        }
      } else {
        // Single year or less, use regular spacing
        const step = Math.floor(dataLength / (maxTicks - 1))
        for (let i = 1; i < maxTicks - 1; i++) {
          const index = i * step
          if (index < uniqueDatesMulti.length) {
            selectedDates.push(uniqueDatesMulti[index])
          }
        }
      }
      
      // Always include last date if different from the last selected
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates.sort((a, b) => a.getTime() - b.getTime())
    } else if (dataLength > 90) {
      // For 3M-1.5Y ranges, use month-based selection to avoid duplicates
      const selectedDates = []
      const firstDate = uniqueDatesMulti[0]
      const lastDate = uniqueDatesMulti[uniqueDatesMulti.length - 1]
      
      // Always include first date
      selectedDates.push(firstDate)
      
      // Try to get roughly monthly intervals
      const monthsSpan = ((lastDate.getFullYear() - firstDate.getFullYear()) * 12) + 
                        (lastDate.getMonth() - firstDate.getMonth())
      
      if (monthsSpan > 1) {
        const monthStep = Math.max(1, Math.floor(monthsSpan / (maxTicks - 2)))
        
        for (let i = 1; i < maxTicks - 1; i++) {
          const targetMonths = i * monthStep
          const targetDate = new Date(firstDate)
          targetDate.setMonth(targetDate.getMonth() + targetMonths)
          
          // Find closest actual date to our target
          const closestDate = uniqueDatesMulti.reduce((closest, date) => {
            const dateDiff = Math.abs(date.getTime() - targetDate.getTime())
            const closestDiff = Math.abs(closest.getTime() - targetDate.getTime())
            return dateDiff < closestDiff ? date : closest
          })
          
          if (!selectedDates.find(d => d.getTime() === closestDate.getTime())) {
            selectedDates.push(closestDate)
          }
        }
      }
      
      // Always include last date if different from the last selected
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates.sort((a, b) => a.getTime() - b.getTime())
    } else {
      // Regular spacing for shorter ranges
      const step = Math.floor(dataLength / (maxTicks - 1))
      const selectedDates = []
      
      selectedDates.push(uniqueDatesMulti[0])
      
      for (let i = 1; i < maxTicks - 1; i++) {
        const index = i * step
        if (index < uniqueDatesMulti.length) {
          selectedDates.push(uniqueDatesMulti[index])
        }
      }
      
      const lastDate = uniqueDatesMulti[uniqueDatesMulti.length - 1]
      if (selectedDates[selectedDates.length - 1].getTime() !== lastDate.getTime()) {
        selectedDates.push(lastDate)
      }
      
      return selectedDates
    }
  }, [uniqueDatesMulti])

  // Memoize mouse event handlers for MultiTickerChart
  const handleMouseMove = useCallback((point: Record<string, unknown>) => {
    if (point) {
      setHoveredPoint(point as HoveredPoint)
    }
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null)
  }, [])

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

    return transformMultipleTickersToNivo(processedData, priceField)
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
            <h3 className="text-lg font-semibold text-gray-900">Price Comparison</h3>
            <p className="text-sm text-gray-600">
              {Object.keys(tickersData || {}).length} tickers
            </p>
          </div>
          
          {hoveredPoint && (
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {hoveredPoint.serieId}
              </div>
              <div className="text-sm font-semibold" style={{ color: hoveredPoint.color }}>
                {formatPrice(hoveredPoint.y)}
              </div>
              <div className="text-sm font-medium text-gray-700">
                {new Date(hoveredPoint.x).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
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
            </div>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div style={{ height: chartHeightMemo, overflow: 'visible' }}>
        <ResponsiveLine
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
            tickValues: smartTickValuesMulti, // Use smart tick selection for readability
            format: (value: Date) => formatChartDate(value, totalDataPoints),
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            format: (value: number) => formatPrice(value),
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
          animate={totalDataPoints > 200 ? false : true}
          motionConfig="gentle"
          lineWidth={2}
          enableArea={chartType === 'area'}
          areaOpacity={areaOpacity}
          areaBaselineValue="auto"
          defs={chartType === 'area' ? [
            {
              id: 'gradientA',
              type: 'linearGradient',
              colors: [
                { offset: 0, color: 'inherit' },
                { offset: 100, color: 'inherit', opacity: 0 },
              ],
            },
          ] : []}
          fill={chartType === 'area' ? [
            { match: '*', id: 'gradientA' },
          ] : []}
          layers={[
            'grid',
            'axes',
            'areas',
            'crosshair',
            'lines',
            'points',
            'slices',
            'mesh',
            'legends',
          ]}
          sliceTooltip={tooltipHandler}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  )
}
// Export memoized MultiTickerChart for performance optimization
export const MultiTickerChart = memo(MultiTickerChartComponent)
MultiTickerChart.displayName = 'MultiTickerChart'