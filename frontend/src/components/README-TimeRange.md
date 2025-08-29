# Time Range Selection and Data Fetching Components

This module provides comprehensive time range selection and data fetching functionality for the stock detail page. It integrates with the existing API endpoint and provides robust error handling, caching, and URL state management.

## Components Overview

### 1. TimeRangeSelector Component
**File:** `TimeRangeSelector.tsx`

A responsive time range selector with predefined ranges and custom date picker.

```typescript
import { TimeRangeSelector } from '@/components/TimeRangeSelector'

<TimeRangeSelector
  selectedRange={timeRange}
  onRangeChange={handleTimeRangeChange}
  disabled={loading}
  showDateRange={true}
/>
```

**Features:**
- Time ranges: 1D, 5D, 1M, 3M, 6M, 1Y, 5Y, MAX, Custom
- Mobile-responsive button layout
- Custom date picker for CUSTOM range
- Active state styling matching existing design system
- Date range display

**Props:**
- `selectedRange: TimeRange` - Currently selected time range
- `onRangeChange: (range: TimeRange, customStart?: string, customEnd?: string) => void` - Change handler
- `disabled?: boolean` - Disable all buttons (during loading)
- `showDateRange?: boolean` - Show calculated date range below buttons
- `className?: string` - Additional CSS classes

### 2. CompactTimeRangeSelector Component
**File:** `TimeRangeSelector.tsx`

A compact variant for smaller spaces (no custom range support).

```typescript
import { CompactTimeRangeSelector } from '@/components/TimeRangeSelector'

<CompactTimeRangeSelector
  selectedRange={timeRange}
  onRangeChange={handleTimeRangeChange}
  disabled={loading}
/>
```

## Hooks

### 1. useStockData Hook
**File:** `hooks/useStockData.ts`

Comprehensive hook for fetching stock data with caching, error handling, and request management.

```typescript
import { useStockData } from '@/hooks/useStockData'

const {
  data,           // StockDataResponse | null
  loading,        // boolean
  error,          // string | null
  lastFetched,    // Date | null
  fetchData,      // Function to fetch data
  refetch,        // Function to force refresh
  retry,          // Function to retry last request
  clearError,     // Function to clear error state
  cancel          // Function to cancel ongoing request
} = useStockData()

// Fetch data for a symbol with time range
await fetchData(['AAPL'], '1M')
```

**Features:**
- 5-minute data caching to avoid unnecessary API calls
- Automatic request cancellation when new requests start
- Structured error handling with retry functionality
- Force refresh capability
- Loading state management

### 2. useUrlState Hook
**File:** `hooks/useUrlState.ts`

Manages URL state synchronization for time ranges and other parameters.

```typescript
import { useUrlState } from '@/hooks/useUrlState'

const {
  timeRange,        // Current time range from URL
  symbol,           // Current symbol from URL
  customStart,      // Custom start date from URL
  customEnd,        // Custom end date from URL
  setTimeRange,     // Update time range in URL
  setSymbol,        // Update symbol in URL
  clearUrlState,    // Clear all URL parameters
  getShareableUrl   // Get current URL for sharing
} = useUrlState('AAPL')
```

**Features:**
- Syncs state with URL search parameters
- Browser back/forward button support
- Shareable URLs
- Default value handling

## Utilities

### 1. Time Range Utilities
**File:** `utils/timeRange.ts`

Helper functions for date calculations and time range management.

```typescript
import { 
  calculateStartDate, 
  calculateEndDate, 
  getDefaultTimeRange,
  formatDateRange,
  isValidTimeRange 
} from '@/utils/timeRange'

// Calculate dates for API calls
const startDate = calculateStartDate('1M')
const endDate = calculateEndDate('1M')

// Validate time range from URL
if (isValidTimeRange(urlParam)) {
  // Use the time range
}
```

## Types

### 1. Stock Data Types
**File:** `types/stock.ts`

Complete TypeScript interfaces for type safety.

```typescript
import type { 
  TimeRange, 
  StockDataResponse, 
  StockDataOptions,
  UseStockDataResult 
} from '@/types/stock'
```

## Integration Examples

### Agent A Integration (Page Structure)
```typescript
import { TimeRangeSelector } from '@/components/TimeRangeSelector'
import { useStockData } from '@/hooks/useStockData'
import { useUrlState } from '@/hooks/useUrlState'

function StockPage({ symbol }: { symbol: string }) {
  const { timeRange, setTimeRange } = useUrlState(symbol)
  const { data, loading, error, fetchData } = useStockData()

  useEffect(() => {
    fetchData([symbol], timeRange)
  }, [symbol, timeRange])

  return (
    <div>
      <TimeRangeSelector
        selectedRange={timeRange}
        onRangeChange={setTimeRange}
        disabled={loading}
      />
      {/* Other page content */}
    </div>
  )
}
```

### Agent B Integration (Chart Component)
```typescript
function ChartComponent({ data, symbol, timeRange, loading, error }) {
  // Use the fetched data for chart rendering
  const chartData = data?.data[symbol]?.data || []
  
  if (loading) return <LoadingChart />
  if (error) return <ErrorChart />
  
  return (
    <div>
      <YourChartLibrary data={chartData} />
    </div>
  )
}
```

## API Integration

The components integrate with the existing `/data/fetch` endpoint:

```typescript
// API call structure
const response = await fetch('http://localhost:8000/data/fetch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tickers: [symbol],
    start_date: calculateStartDate(timeRange),
    end_date: calculateEndDate(timeRange),
    include_dividends: false,
    force_refresh: false,
    max_workers: 5
  })
})
```

## Error Handling

The system provides comprehensive error handling:

- **Network errors** - Connection failures
- **API errors** - Server responses (4xx, 5xx)
- **Invalid tickers** - Unknown symbols
- **Timeout errors** - Request cancellation
- **Unknown errors** - Fallback handling

Each error type has specific messaging and retry strategies.

## Caching Strategy

- **Cache duration:** 5 minutes per request
- **Cache key:** Based on tickers, dates, and options
- **Cache invalidation:** Automatic expiry or force refresh
- **Memory management:** Map-based cache with timestamp tracking

## URL State Management

URL parameters:
- `range` - Time range (1D, 5D, 1M, etc.)
- `symbol` - Stock symbol
- `start` - Custom start date (CUSTOM range only)
- `end` - Custom end date (CUSTOM range only)

Example URLs:
- `/stock/AAPL?range=1M`
- `/stock/AAPL?range=CUSTOM&start=2024-01-01&end=2024-03-31`

## Performance Considerations

1. **Request cancellation** - Previous requests are cancelled when new ones start
2. **Data caching** - 5-minute cache reduces API calls
3. **Debounced updates** - URL updates use replace for time ranges
4. **Memory management** - Cleanup on component unmount
5. **Error boundaries** - Graceful fallbacks for component failures

## Testing

Key test scenarios:
1. Time range selection changes
2. Custom date picker validation
3. API error handling and retry
4. URL state synchronization
5. Cache behavior
6. Request cancellation
7. Mobile responsive layout

## Browser Support

- Modern browsers with ES2020+ support
- Next.js 15 App Router compatibility
- React 19 hooks support
- URL API for state management
- AbortController for request cancellation