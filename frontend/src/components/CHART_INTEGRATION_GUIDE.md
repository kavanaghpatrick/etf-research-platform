# Stock Chart Integration Guide

This guide shows how to integrate the Nivo-based chart components into your stock detail pages and dashboards.

## Components Overview

### 1. StockChart
A single-ticker chart component with full customization options.

### 2. MultiTickerChart  
A comparison chart for multiple tickers on the same axes.

### 3. Chart Utilities
Helper functions for data transformation and formatting.

## Quick Start

### Basic Single Ticker Chart

```tsx
import { StockChart } from './components/StockChart'

function MyStockPage({ tickerData }) {
  return (
    <StockChart
      data={tickerData.data}
      ticker="AAPL"
      height="70vh"
      chartType="line"
    />
  )
}
```

### Multi-Ticker Comparison

```tsx
import { MultiTickerChart } from './components/StockChart'

function MyComparisonPage({ allTickersData }) {
  return (
    <MultiTickerChart
      tickersData={allTickersData}
      height="500px"
      chartType="area"
    />
  )
}
```

## Integration with ResultsDashboard

### Option 1: Add as New Tab

```tsx
// In ResultsDashboard.tsx, add to tabs array:
const tabs = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'data', label: 'Data', icon: '📈' },
  { id: 'charts', label: 'Charts', icon: '📉' }, // Add this
  // ... other tabs
]

// Add to tab content section:
{activeTab === 'charts' && (
  <ChartTab data={data} />
)}
```

### Option 2: Embed Mini Charts in Overview

```tsx
// In OverviewTab component:
import { MiniChart } from './ChartIntegrationExample'

// Add to ticker summary cards:
<div key={ticker} className="border border-gray-200 rounded-lg p-4">
  <div className="flex items-center justify-between mb-4">
    {/* existing ticker info */}
  </div>
  
  {/* Add mini chart */}
  <MiniChart 
    data={tickerData.data} 
    ticker={ticker} 
    height="150px" 
  />
</div>
```

## Props Reference

### StockChart Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `ApiTickerData[]` | required | Array of OHLCV data points |
| `ticker` | `string` | `'Stock'` | Display name for the ticker |
| `height` | `string \| number` | `'70vh'` | Chart height (CSS or pixels) |
| `chartType` | `'line' \| 'area'` | `'line'` | Chart visualization type |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `error` | `string` | `undefined` | Error message to display |
| `showGrid` | `boolean` | `true` | Show grid lines |
| `enableCrosshair` | `boolean` | `true` | Enable crosshair cursor |
| `maxDataPoints` | `number` | `500` | Max points for performance |
| `priceField` | `'Open' \| 'High' \| 'Low' \| 'Close'` | `'Close'` | Which price to chart |
| `className` | `string` | `''` | Additional CSS classes |

### MultiTickerChart Props

Same as StockChart except:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `tickersData` | `Record<string, {data: ApiTickerData[]}>` | required | Multiple tickers data |
| `maxDataPoints` | `number` | `500` | Max points per ticker |

## Data Format

The charts expect data in this format:

```typescript
interface ApiTickerData {
  Date: string;      // ISO date string
  Open: number;      // Opening price  
  High: number;      // High price
  Low: number;       // Low price
  Close: number;     // Closing price
  Volume: number;    // Trading volume
}
```

This matches the format from your existing ResultsDashboard data structure.

## Styling & Theming

Charts use TailwindCSS-compatible colors:

- **Primary**: `#3b82f6` (blue-500)
- **Text**: `#374151` (gray-700) 
- **Borders**: `#e5e7eb` (gray-200)
- **Grid**: `#f3f4f6` (gray-100)

Colors automatically adapt to your existing design system.

## Performance Optimizations

### Automatic Data Downsampling
- Charts automatically downsample large datasets
- Default: 500 points max per ticker
- Configurable via `maxDataPoints` prop

### Animation Control
- Animations disabled for datasets > 200 points
- Improves performance on large data
- Smooth animations on smaller datasets

### Responsive Design
- Charts automatically resize
- Mobile-optimized touch interactions
- Adaptive date formatting based on screen size

## Advanced Usage

### Custom Tooltip

```tsx
<StockChart
  data={data}
  ticker="AAPL"
  tooltip={({ point }) => (
    <div className="custom-tooltip">
      <div>{point.serieId}</div>
      <div>{formatPrice(point.data.y)}</div>
      <div>{formatDate(point.data.x)}</div>
    </div>
  )}
/>
```

### Loading States

```tsx
<StockChart
  data={data}
  ticker="AAPL"
  loading={isLoading}
  error={error}
/>
```

### Price Field Selection

```tsx
// Show different price fields
<StockChart data={data} priceField="High" />  // High prices
<StockChart data={data} priceField="Low" />   // Low prices
<StockChart data={data} priceField="Open" />  // Opening prices
```

## Utility Functions

### Data Transformation

```tsx
import { transformToNivoFormat, formatPrice } from './chartUtils'

// Transform API data to Nivo format
const nivoData = transformToNivoFormat(apiData, 'Close', 'AAPL')

// Format prices for display
const formattedPrice = formatPrice(123.45) // "$123.45"
```

### Price Analysis

```tsx
import { calculatePriceChange } from './chartUtils'

const change = calculatePriceChange(apiData)
console.log(change.changePercent) // 5.23
console.log(change.isPositive)    // true
```

## Error Handling

Charts include built-in error states:

- **Loading**: Animated spinner with loading text
- **Error**: Red error box with error message  
- **Empty**: Gray empty state when no data
- **Network**: Automatic retry capabilities

## Mobile Responsiveness

Charts automatically adapt to mobile:

- **Touch-friendly**: Optimized touch interactions
- **Responsive sizing**: Automatic height/width adjustment
- **Simplified UI**: Fewer controls on small screens
- **Performance**: Reduced data points on mobile

## Integration Checklist

- [ ] Install Nivo packages
- [ ] Import chart components
- [ ] Transform data format (if needed)
- [ ] Add to existing dashboard tabs
- [ ] Test responsive behavior
- [ ] Verify performance with large datasets
- [ ] Add loading/error states
- [ ] Style to match design system

## Troubleshooting

### Common Issues

**Chart not rendering:**
- Check data format matches `ApiTickerData[]`
- Ensure dates are valid ISO strings
- Verify numeric values for OHLCV

**Performance issues:**
- Reduce `maxDataPoints` (try 100-300)
- Disable animations: set data length > 200
- Use `chartType="line"` instead of `"area"`

**Styling issues:**
- Ensure TailwindCSS is properly configured
- Check for CSS conflicts with existing styles
- Verify chart container has proper height

### Browser Support

- **Modern browsers**: Full support
- **IE 11**: Not supported (Nivo limitation)  
- **Mobile Safari**: Full support
- **Chrome/Firefox**: Full support

## Need Help?

The chart components are designed to be drop-in replacements that work with your existing data structure. They include comprehensive error handling, loading states, and performance optimizations out of the box.