export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Navigation Breadcrumb Skeleton */}
        <nav className="mb-6">
          <div className="flex items-center space-x-2 text-sm">
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
            <span className="text-gray-400">›</span>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </nav>

        {/* Stock Header Skeleton */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-6 w-16 bg-blue-200 rounded-full animate-pulse"></div>
            </div>
            
            <div className="text-right">
              <div className="h-8 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Key Metrics Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mx-auto mb-1"></div>
                <div className="h-5 w-12 bg-gray-200 rounded animate-pulse mx-auto"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="bg-white rounded-xl shadow-lg">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="py-4 px-1">
                  <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </nav>
          </div>

          {/* Tab Content Skeleton */}
          <div className="p-6">
            {/* Loading Spinner */}
            <div className="text-center py-12">
              <div className="inline-flex items-center space-x-4">
                <div className="relative">
                  <div className="w-12 h-12 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600"></div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Loading Stock Data
                  </h3>
                  <p className="text-gray-600 mt-1">
                    Fetching the latest market information...
                  </p>
                </div>
              </div>

              {/* Progress indicators */}
              <div className="mt-8 max-w-md mx-auto">
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
                    Fetching stock data
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                    Loading price history
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '1s' }}></div>
                    Analyzing dividends
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mr-3 animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                    Preparing analysis
                  </div>
                </div>
              </div>

              {/* Content Grid Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-8 w-16 bg-gray-200 rounded animate-pulse mb-1"></div>
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Data source status */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {['AlphaVantage', 'Tiingo', 'Finnhub', 'YFinance'].map((source) => (
              <div key={source} className="flex items-center justify-center p-2 bg-gray-100 rounded">
                <div className="w-2 h-2 bg-gray-300 rounded-full mr-2 animate-pulse"></div>
                <span className="text-gray-500">{source}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Loading detailed stock analysis and market data...
        </p>
      </div>
    </main>
  )
}