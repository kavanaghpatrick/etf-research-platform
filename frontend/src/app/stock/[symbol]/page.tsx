'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import StockDetailClient from './StockDetailClient'
import { 
  SingleStockResponse,
  StockPageParams 
} from '@/types/stock'
import { apiRequest, API_ENDPOINTS, createApiError, sanitizeErrorMessage } from '@/utils/api'

interface PageProps {
  params: Promise<StockPageParams>
}

// Client-side stock detail page component
export default function StockDetailPage({ params }: PageProps) {
  const [stockData, setStockData] = useState<SingleStockResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadStockData() {
      try {
        const { symbol } = await params
        const symbolUpper = symbol.toUpperCase()
        
        // Validate symbol format
        if (!symbol || symbol.length > 10 || !/^[A-Za-z]+$/.test(symbol)) {
          setError('Invalid symbol format')
          setLoading(false)
          return
        }

        // Fetch stock data client-side
        const data = await apiRequest<any>(API_ENDPOINTS.FETCH_DATA, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tickers: [symbolUpper],
            start_date: (() => {
              const sixMonthsAgo = new Date()
              sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
              return sixMonthsAgo.toISOString().split('T')[0]
            })(),
            end_date: new Date().toISOString().split('T')[0],
            force_refresh: false,
            include_dividends: true,
            max_workers: 1
          }),
          timeout: 10000,
          retries: 3,
        })
        
        // Check if we have data for the requested symbol
        if (!data.data || !data.data[symbolUpper]) {
          setError(`No data found for symbol: ${symbolUpper}`)
          setLoading(false)
          return
        }

        const stockInfo = data.data[symbolUpper]
        const dividendData = data.dividend_data?.[symbolUpper]
        
        // Transform the data to match our SingleStockResponse interface
        const singleStockResponse: SingleStockResponse = {
          symbol: symbolUpper,
          data: stockInfo.data,
          date_range: stockInfo.date_range,
          dividend_data: dividendData,
          // Add computed values
          current_price: stockInfo.data.length > 0 ? stockInfo.data[stockInfo.data.length - 1].Close : undefined,
          price_change: stockInfo.data.length > 1 
            ? stockInfo.data[stockInfo.data.length - 1].Close - stockInfo.data[stockInfo.data.length - 2].Close 
            : undefined,
          price_change_percent: stockInfo.data.length > 1 
            ? ((stockInfo.data[stockInfo.data.length - 1].Close - stockInfo.data[stockInfo.data.length - 2].Close) / stockInfo.data[stockInfo.data.length - 2].Close) * 100
            : undefined,
        }

        setStockData(singleStockResponse)
        setLoading(false)
      } catch (err) {
        const errorInfo = createApiError(err)
        setError(`Failed to load stock data: ${errorInfo.message}`)
        setLoading(false)
      }
    }

    loadStockData()
  }, [params])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Loading skeleton */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="flex space-x-4">
                  <div className="h-10 bg-gray-200 rounded w-20"></div>
                  <div className="h-10 bg-gray-200 rounded w-20"></div>
                  <div className="h-10 bg-gray-200 rounded w-20"></div>
                </div>
              </div>
            </div>
            
            {/* Chart skeleton */}
            <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !stockData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-4">{error || 'Stock data not found'}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return <StockDetailClient stockData={stockData} />
}