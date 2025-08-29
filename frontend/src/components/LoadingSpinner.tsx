'use client'

export function LoadingSpinner() {
  return (
    <div className="text-center py-12" role="status" aria-live="polite">
      <div className="inline-flex items-center space-x-4">
        {/* Animated spinner */}
        <div className="relative" aria-hidden="true">
          <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Analyzing Your Portfolio
          </h3>
          <p className="text-gray-600 mt-1">
            Fetching data from multiple sources with intelligent fallback...
          </p>
        </div>
      </div>

      {/* Progress indicators */}
      <div className="mt-8 max-w-md mx-auto">
        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
            Connecting to data sources
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
            Fetching historical data
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '1s' }}></div>
            Validating data quality
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
            Preparing analysis
          </div>
        </div>
      </div>

      {/* Data source status */}
      <div className="mt-8 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Data Source Status</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center justify-center p-2 bg-green-100 rounded">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            AlphaVantage
          </div>
          <div className="flex items-center justify-center p-2 bg-blue-100 rounded">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Tiingo
          </div>
          <div className="flex items-center justify-center p-2 bg-purple-100 rounded">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
            Finnhub
          </div>
          <div className="flex items-center justify-center p-2 bg-orange-100 rounded">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            YFinance
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        This may take 10-30 seconds depending on the number of tickers and data availability
      </p>
    </div>
  )
}