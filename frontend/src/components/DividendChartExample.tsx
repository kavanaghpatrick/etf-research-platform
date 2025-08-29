'use client'

import { useState } from 'react'
import { StockChart } from './StockChart'
import { ApiTickerData, DividendOverlayOptions, TimeRange } from '@/types/stock'

// Example data for testing - Apple stock data points
const EXAMPLE_STOCK_DATA: ApiTickerData[] = [
  { Date: '2023-01-01', Open: 130.50, High: 132.00, Low: 129.50, Close: 131.75, Volume: 50000000 },
  { Date: '2023-02-01', Open: 131.75, High: 134.20, Low: 130.80, Close: 133.15, Volume: 48000000 },
  { Date: '2023-03-01', Open: 133.15, High: 135.50, Low: 132.00, Close: 134.80, Volume: 52000000 },
  { Date: '2023-04-01', Open: 134.80, High: 137.20, Low: 133.50, Close: 136.90, Volume: 47000000 },
  { Date: '2023-05-01', Open: 136.90, High: 139.80, Low: 135.20, Close: 138.45, Volume: 51000000 },
  { Date: '2023-06-01', Open: 138.45, High: 141.00, Low: 137.50, Close: 140.20, Volume: 49000000 },
  { Date: '2023-07-01', Open: 140.20, High: 142.80, Low: 139.10, Close: 141.65, Volume: 53000000 },
  { Date: '2023-08-01', Open: 141.65, High: 144.50, Low: 140.80, Close: 143.20, Volume: 46000000 },
  { Date: '2023-09-01', Open: 143.20, High: 145.90, Low: 142.30, Close: 144.75, Volume: 50000000 },
  { Date: '2023-10-01', Open: 144.75, High: 147.20, Low: 143.80, Close: 146.10, Volume: 48000000 },
  { Date: '2023-11-01', Open: 146.10, High: 148.80, Low: 145.20, Close: 147.95, Volume: 52000000 },
  { Date: '2023-12-01', Open: 147.95, High: 150.40, Low: 146.90, Close: 149.25, Volume: 45000000 },
]

/**
 * Example component demonstrating dividend chart integration
 */
export function DividendChartExample() {
  const [dividendEnabled, setDividendEnabled] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y')
  
  const dividendOverlay: DividendOverlayOptions = {
    show: dividendEnabled,
    showMarkers: true,
    showTooltips: true,
    markerSize: 8,
    markerColor: '#dc2626', // red-600
  }

  const handleDividendToggle = (enabled: boolean) => {
    setDividendEnabled(enabled)
    console.log(`Dividend overlay ${enabled ? 'enabled' : 'disabled'}`)
  }

  const handleTimeRangeChange = (range: TimeRange) => {
    setTimeRange(range)
    console.log(`Time range changed to: ${range}`)
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Dividend Chart Integration Example
          </h1>
          <p className="text-gray-600">
            This example demonstrates the enhanced StockChart component with dividend overlay functionality.
            Toggle the dividend overlay to see dividend markers on the chart.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Controls</h2>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dividend Overlay
              </label>
              <button
                onClick={() => handleDividendToggle(!dividendEnabled)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  dividendEnabled
                    ? 'bg-red-100 text-red-800 hover:bg-red-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {dividendEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => handleTimeRangeChange(e.target.value as TimeRange)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1M">1 Month</option>
                <option value="3M">3 Months</option>
                <option value="6M">6 Months</option>
                <option value="1Y">1 Year</option>
                <option value="5Y">5 Years</option>
                <option value="MAX">Max</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white rounded-lg border border-gray-200">
          <StockChart
            data={EXAMPLE_STOCK_DATA}
            ticker="AAPL"
            height="500px"
            chartType="line"
            enableDividends={true}
            dividendOverlay={dividendOverlay}
            timeRange={timeRange}
            onDividendToggle={handleDividendToggle}
            showGrid={true}
            enableCrosshair={true}
            maxDataPoints={500}
            priceField="Close"
          />
        </div>

        {/* Information */}
        <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Features Demonstrated
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Dividend overlay toggle button in chart header</li>
            <li>• Dividend markers as red dots on the chart</li>
            <li>• Enhanced tooltips showing dividend information when hovering over dividend dates</li>
            <li>• Dividend count and total amount display in chart header</li>
            <li>• Integration with time range selection</li>
            <li>• Loading and error states for dividend data fetching</li>
          </ul>
        </div>

        {/* Integration Notes */}
        <div className="mt-6 bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <h3 className="text-lg font-semibold text-yellow-900 mb-2">
            Integration Notes
          </h3>
          <div className="text-sm text-yellow-800 space-y-2">
            <p>
              <strong>Backend Integration:</strong> The component fetches dividend data from 
              <code className="bg-yellow-100 px-1 rounded">/api/dividends/&#123;ticker&#125;</code> endpoint.
            </p>
            <p>
              <strong>Data Fetching:</strong> Uses the <code className="bg-yellow-100 px-1 rounded">useDividendData</code> hook 
              which integrates with existing data fetching patterns.
            </p>
            <p>
              <strong>Chart Annotations:</strong> Dividend markers are implemented using Nivo's annotation system 
              for seamless integration with chart interactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DividendChartExample