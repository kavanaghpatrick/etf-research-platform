import Link from 'next/link'

export default function NotFound() {
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
            <span className="text-gray-900 font-medium">Stock Not Found</span>
          </div>
        </nav>

        {/* Not Found Content */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m-6-4h6M7 20h10a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Stock Symbol Not Found
          </h1>
          
          <p className="text-lg text-gray-600 mb-6 max-w-md mx-auto">
            The stock symbol you&apos;re looking for doesn&apos;t exist or isn&apos;t available in our database.
            Please check the symbol and try again.
          </p>

          {/* Helpful Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Tips for Finding Stocks:</h3>
            <ul className="space-y-3 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Use the correct ticker symbol:</strong> For example, use &quot;AAPL&quot; for Apple Inc., not &quot;Apple&quot;</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Check symbol spelling:</strong> Make sure there are no typos in the stock symbol</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Verify the stock exists:</strong> Some stocks may have been delisted or merged</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Try different exchanges:</strong> Some international stocks might not be available</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href="/"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-center"
            >
              Search Again
            </Link>
            
            <Link
              href="/"
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center"
            >
              Browse Popular Stocks
            </Link>
          </div>

          {/* Popular Stocks Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Popular Stocks & ETFs:</h3>
            
            {/* Large Cap Stocks */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Large Cap Stocks:</h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'].map((symbol) => (
                  <Link
                    key={symbol}
                    href={`/stock/${symbol.toLowerCase()}`}
                    className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-800 rounded-full transition-colors"
                  >
                    {symbol}
                  </Link>
                ))}
              </div>
            </div>

            {/* Popular ETFs */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Popular ETFs:</h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {['SPY', 'QQQ', 'VTI', 'IWM', 'DIA', 'VEA', 'VWO', 'GLD'].map((symbol) => (
                  <Link
                    key={symbol}
                    href={`/stock/${symbol.toLowerCase()}`}
                    className="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full transition-colors"
                  >
                    {symbol}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Search Form */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 text-center">Try a New Search</h3>
          <form action="/" method="get" className="max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                name="symbol"
                placeholder="Enter stock symbol (e.g., AAPL)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Search
              </button>
            </div>
          </form>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Enter a valid stock ticker symbol to get detailed analysis
          </p>
        </div>

        {/* Help Information */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Need help finding a specific stock? Try searching from the{' '}
            <Link href="/" className="text-blue-600 hover:text-blue-800 underline">
              homepage
            </Link>{' '}
            or browse popular stocks above.
          </p>
        </div>
      </div>
    </main>
  )
}