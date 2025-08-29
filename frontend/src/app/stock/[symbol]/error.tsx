'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Stock page error:', error)
  }, [error])

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
            <span className="text-gray-900 font-medium">Error</span>
          </div>
        </nav>

        {/* Error Content */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Stock Data Unavailable
          </h1>
          
          <p className="text-lg text-gray-600 mb-6 max-w-md mx-auto">
            We couldn&apos;t load the stock information you requested. This could be due to an invalid symbol, 
            network issues, or the stock may not be available in our database.
          </p>

          {/* Error Details */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
            <h3 className="text-sm font-medium text-red-800 mb-2">Error Details:</h3>
            <p className="text-sm text-red-700">{error.message}</p>
            {error.digest && (
              <p className="text-xs text-red-600 mt-1">Error ID: {error.digest}</p>
            )}
          </div>

          {/* Common Issues */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6 text-left max-w-2xl mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Common Issues:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Invalid Symbol:</strong> Check that the stock ticker is spelled correctly (e.g., AAPL, MSFT, GOOGL)</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Delisted Stock:</strong> The stock may have been delisted or is no longer trading</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Data Source Issues:</strong> Temporary issues with market data providers</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                <span><strong>Network Issues:</strong> Connection problems preventing data retrieval</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={reset}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            
            <Link
              href="/"
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 text-center"
            >
              Return Home
            </Link>
          </div>

          {/* Popular Stocks Suggestions */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Try These Popular Stocks:</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'META', 'AMZN', 'SPY', 'QQQ', 'VTI'].map((symbol) => (
                <Link
                  key={symbol}
                  href={`/stock/${symbol.toLowerCase()}`}
                  className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full transition-colors"
                >
                  {symbol}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Data Sources Status */}
        <div className="mt-6 bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Data Source Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {[
              { name: 'AlphaVantage', status: 'checking' },
              { name: 'Tiingo', status: 'checking' },
              { name: 'Finnhub', status: 'checking' },
              { name: 'YFinance', status: 'checking' }
            ].map((source) => (
              <div key={source.name} className="flex items-center justify-center p-2 bg-gray-100 rounded">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2 animate-pulse"></div>
                {source.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Our system uses multiple data sources with intelligent fallback for maximum reliability
          </p>
        </div>

        {/* Support Information */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Need help? Contact our support team or check the{' '}
            <Link href="/help" className="text-blue-600 hover:text-blue-800 underline">
              help documentation
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}