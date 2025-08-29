'use client'

import { StockChart, MultiTickerChart } from './StockChart'
import { ApiTickerData } from './chartUtils'

// Sample test data that matches the ResultsDashboard format
const sampleData: ApiTickerData[] = [
  { Date: '2024-01-01', Open: 100, High: 105, Low: 95, Close: 102, Volume: 1000000 },
  { Date: '2024-01-02', Open: 102, High: 108, Low: 100, Close: 106, Volume: 1100000 },
  { Date: '2024-01-03', Open: 106, High: 110, Low: 104, Close: 108, Volume: 900000 },
  { Date: '2024-01-04', Open: 108, High: 115, Low: 107, Close: 112, Volume: 1200000 },
  { Date: '2024-01-05', Open: 112, High: 118, Low: 110, Close: 115, Volume: 1300000 },
]

const sampleMultiData = {
  AAPL: { data: sampleData },
  GOOGL: { 
    data: sampleData.map(d => ({
      ...d,
      Open: d.Open * 2.5,
      High: d.High * 2.5,
      Low: d.Low * 2.5,
      Close: d.Close * 2.5,
    }))
  },
}

export function ChartTest() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-6">Chart Component Test</h1>
      </div>

      {/* Single Chart Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Single Ticker Chart</h2>
        <StockChart
          data={sampleData}
          ticker="AAPL"
          height="400px"
          chartType="line"
        />
      </div>

      {/* Area Chart Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Area Chart</h2>
        <StockChart
          data={sampleData}
          ticker="AAPL"
          height="400px"
          chartType="area"
        />
      </div>

      {/* Multi-Ticker Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Multi-Ticker Comparison</h2>
        <MultiTickerChart
          tickersData={sampleMultiData}
          height="400px"
          chartType="line"
        />
      </div>

      {/* Loading State Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Loading State</h2>
        <StockChart
          data={[]}
          ticker="TEST"
          height="300px"
          loading={true}
        />
      </div>

      {/* Error State Test */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Error State</h2>
        <StockChart
          data={[]}
          ticker="TEST"
          height="300px"
          error="Failed to load chart data"
        />
      </div>
    </div>
  )
}