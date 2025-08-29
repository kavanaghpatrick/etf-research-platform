'use client'

import { lazy, Suspense } from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { ErrorBoundary } from './ErrorBoundary'
import { ChartProfiler } from './PerformanceProfiler'
import { StockChartProps, MultiTickerChartProps } from './StockChart'

// Dynamically import the heavy StockChart component
const StockChart = lazy(() => 
  import('./StockChart').then(module => ({ default: module.StockChart }))
)

const MultiTickerChart = lazy(() =>
  import('./StockChart').then(module => ({ default: module.MultiTickerChart }))
)

// Loading fallback component optimized for chart loading
const ChartLoadingFallback = ({ height }: { height?: string | number }) => {
  const heightStyle = typeof height === 'string' ? height : `${height || 400}px`
  
  return (
    <div 
      className="flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200 animate-pulse"
      style={{ height: heightStyle }}
    >
      <div className="flex flex-col items-center space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <p className="text-sm text-gray-500">Loading chart...</p>
        <div className="w-32 h-2 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  )
}

// Custom error fallback for charts
const ChartErrorFallback = ({ error, resetError, height }: { 
  error: Error
  resetError: () => void
  height?: string | number 
}) => {
  const heightStyle = typeof height === 'string' ? height : `${height || 400}px`
  
  return (
    <div 
      className="flex items-center justify-center bg-red-50 rounded-lg border border-red-200"
      style={{ height: heightStyle }}
    >
      <div className="flex flex-col items-center space-y-3 p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
          <span className="text-red-500 text-xl">📈</span>
        </div>
        <div>
          <h3 className="text-sm font-medium text-red-800">Chart Error</h3>
          <p className="text-xs text-red-600 mt-1">Failed to load chart component</p>
        </div>
        <button
          onClick={resetError}
          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// Wrapper component with Suspense and Error boundaries
export function LazyStockChart(props: StockChartProps) {
  return (
    <ErrorBoundary
      fallback={(errorProps) => <ChartErrorFallback {...errorProps} height={props.height} />}
      isolateComponent
      resetKeys={[props.ticker, props.data?.length]}
    >
      <Suspense fallback={<ChartLoadingFallback height={props.height} />}>
        <ChartProfiler>
          <StockChart {...props} />
        </ChartProfiler>
      </Suspense>
    </ErrorBoundary>
  )
}

export function LazyMultiTickerChart(props: MultiTickerChartProps) {
  return (
    <ErrorBoundary
      fallback={(errorProps) => <ChartErrorFallback {...errorProps} height={props.height} />}
      isolateComponent
      resetKeys={[Object.keys(props.tickersData || {}).join(',')]}
    >
      <Suspense fallback={<ChartLoadingFallback height={props.height} />}>
        <ChartProfiler>
          <MultiTickerChart {...props} />
        </ChartProfiler>
      </Suspense>
    </ErrorBoundary>
  )
}

// Re-export chart props for convenience
export type { StockChartProps, MultiTickerChartProps }