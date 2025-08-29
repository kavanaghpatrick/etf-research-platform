'use client'

import { useEffect, useState } from 'react'
import { StockChart } from '@/components/StockChart'
import { ApiTickerData } from '@/components/chartUtils'

export default function TestDividends() {
  const [priceData, setPriceData] = useState<ApiTickerData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch price data for AAPL
    fetch('http://localhost:8000/data/fetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tickers: ['AAPL'],
        start: '2024-01-01',
        end: '2024-12-31',
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log('[TestDividends] Price data response:', data)
        if (data.status === 'success' && data.data && data.data.AAPL) {
          setPriceData(data.data.AAPL.data)
        } else {
          setError('Failed to fetch price data')
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('[TestDividends] Error fetching price data:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dividend Markers Test</h1>
      <p className="mb-4">Testing AAPL stock with dividend markers enabled</p>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold mb-2">Debug Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open browser developer console (F12)</li>
          <li>Look for console logs starting with [StockChart], [useDividendData], etc.</li>
          <li>Check Network tab for /dividends/AAPL request</li>
          <li>Click the "Dividends" toggle button to enable/disable markers</li>
        </ol>
      </div>

      {loading && <p>Loading chart data...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      
      {!loading && !error && priceData.length > 0 && (
        <StockChart
          data={priceData}
          ticker="AAPL"
          height="500px"
          enableDividends={true}
          dividendOverlay={{
            show: true,
            markerSize: 10,
            markerColor: '#dc2626',
          }}
        />
      )}
    </div>
  )
}