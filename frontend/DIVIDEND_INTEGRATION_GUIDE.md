# Dividend Visualization Integration Guide

This guide demonstrates how to use the enhanced StockChart component with dividend overlay functionality.

## Overview

The StockChart component has been extended to support dividend visualization with the following features:

- **Dividend Markers**: Red dots on the chart showing dividend ex-dates
- **Toggle Control**: Button to show/hide dividend overlays
- **Enhanced Tooltips**: Dividend information in chart tooltips
- **Data Integration**: Seamless integration with existing data fetching
- **Performance**: Optimized for large datasets with caching

## Quick Start

```tsx
import { StockChart } from '@/components/StockChart'
import { DividendOverlayOptions } from '@/types/stock'

// Basic usage with dividend functionality
function MyChart() {
  const [dividendEnabled, setDividendEnabled] = useState(false)
  
  const dividendOverlay: DividendOverlayOptions = {
    show: dividendEnabled,
    showMarkers: true,
    showTooltips: true,
    markerSize: 8,
    markerColor: '#dc2626'
  }

  return (
    <StockChart
      data={stockData}
      ticker="AAPL"
      enableDividends={true}
      dividendOverlay={dividendOverlay}
      timeRange="1Y"
      onDividendToggle={setDividendEnabled}
    />
  )
}
```

## New Props

### StockChart Component

The StockChart component now accepts these additional props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableDividends` | `boolean` | `false` | Enables dividend functionality |
| `dividendOverlay` | `DividendOverlayOptions` | `undefined` | Dividend display options |
| `timeRange` | `TimeRange` | `undefined` | Time range for dividend fetching |
| `customStartDate` | `string` | `undefined` | Custom start date (ISO format) |
| `customEndDate` | `string` | `undefined` | Custom end date (ISO format) |
| `onDividendToggle` | `(enabled: boolean) => void` | `undefined` | Callback when dividend toggle changes |

### DividendOverlayOptions

```tsx
interface DividendOverlayOptions {
  show: boolean              // Show dividend overlay
  showMarkers: boolean       // Show dividend markers on chart
  showTooltips: boolean      // Enhanced tooltips with dividend info
  markerSize?: number        // Size of dividend markers (default: 8)
  markerColor?: string       // Color of dividend markers (default: '#dc2626')
}
```

## Data Flow

```
1. User toggles dividend display
2. useDividendData hook fetches data from /api/dividends/{ticker}
3. Dividend data is filtered by time range
4. Markers are positioned using price data
5. Chart annotations are created
6. Tooltips are enhanced with dividend information
```

## Backend Integration

The component fetches dividend data from:
```
GET /api/dividends/{ticker}
```

Expected response format:
```json
{
  "status": "success",
  "data": {
    "ticker": "AAPL",
    "dividends": [
      {
        "ex_date": "2023-02-09",
        "dividend_amount": 0.23,
        "dividend_type": "Cash"
      }
    ]
  }
}
```

## Hook Usage

### useDividendData

For basic dividend data fetching:

```tsx
import { useDividendData } from '@/hooks/useDividendData'

function MyComponent() {
  const {
    dividendData,
    loading,
    error,
    fetchDividendData,
    clearError,
    retry
  } = useDividendData()

  useEffect(() => {
    fetchDividendData('AAPL', '1Y')
  }, [])

  if (loading) return <div>Loading dividends...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {dividendData?.count} dividends found
      Total: ${dividendData?.total}
    </div>
  )
}
```

### useDividendDataWithPrices

For integration with price data:

```tsx
import { useDividendDataWithPrices } from '@/hooks/useDividendData'

function ChartWithDividends({ priceData }) {
  const {
    dividendData,
    loading,
    error,
    fetchDividendData,
    updateMarkersWithPrices
  } = useDividendDataWithPrices(priceData)

  useEffect(() => {
    if (priceData) {
      updateMarkersWithPrices(priceData)
    }
  }, [priceData, updateMarkersWithPrices])

  // ... rest of component
}
```

## Advanced Usage

### Custom Dividend Markers

```tsx
const customDividendOverlay: DividendOverlayOptions = {
  show: true,
  showMarkers: true,
  showTooltips: true,
  markerSize: 12,           // Larger markers
  markerColor: '#059669'    // Green markers
}

<StockChart
  data={data}
  ticker="MSFT"
  enableDividends={true}
  dividendOverlay={customDividendOverlay}
  onDividendToggle={(enabled) => {
    console.log(`Dividends ${enabled ? 'enabled' : 'disabled'}`)
    // Additional logic here
  }}
/>
```

### Integration with Time Range Selector

```tsx
function ChartWithTimeRange() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y')
  const [dividendsEnabled, setDividendsEnabled] = useState(false)

  return (
    <div>
      <TimeRangeSelector
        value={timeRange}
        onChange={setTimeRange}
      />
      
      <StockChart
        data={stockData}
        ticker="AAPL"
        timeRange={timeRange}
        enableDividends={true}
        dividendOverlay={{
          show: dividendsEnabled,
          showMarkers: true,
          showTooltips: true
        }}
        onDividendToggle={setDividendsEnabled}
      />
    </div>
  )
}
```

## Styling

### CSS Classes Used

- `bg-red-100 text-red-800` - Enabled dividend toggle button
- `bg-gray-100 text-gray-600` - Disabled dividend toggle button  
- `text-red-600` - Dividend information in tooltips
- `border-t border-gray-100` - Tooltip section divider

### Customization

The dividend markers use Nivo's annotation system and can be styled via the `dividendOverlay` prop. For more advanced styling, you can:

1. Modify the `DIVIDEND_MARKER_COLOR` constant
2. Adjust the annotation properties in the chart memoization
3. Override CSS classes for the toggle button

## Performance Considerations

- **Caching**: Dividend data is cached for 5 minutes
- **Debouncing**: API calls are debounced to prevent excessive requests
- **Lazy Loading**: Dividend data is only fetched when enabled
- **Memory Management**: Previous requests are cancelled when new ones are made

## Error Handling

The component handles various error scenarios:

- **Network Errors**: Shows "Network connection failed" message
- **Invalid Ticker**: Shows "No dividend data found" message  
- **Server Errors**: Shows "Server error. Please try again later"
- **Timeout**: Requests can be cancelled and retried

## Testing

See `/src/components/DividendChartExample.tsx` for a complete working example with:
- Dividend toggle functionality
- Time range integration
- Error state handling
- Loading state management

## Browser Support

The dividend functionality works in all modern browsers that support:
- ES2018+ features
- Fetch API
- AbortController for request cancellation

## Migration Guide

### From Basic StockChart

```tsx
// Before
<StockChart data={data} ticker="AAPL" />

// After
<StockChart 
  data={data} 
  ticker="AAPL"
  enableDividends={true}
  dividendOverlay={{
    show: false,
    showMarkers: true,
    showTooltips: true
  }}
/>
```

The enhanced component is fully backward compatible - existing usage will continue to work without changes.