# API Documentation - ETF Research Platform

This document provides comprehensive documentation for all APIs, hooks, utilities, and components in the ETF Research Platform frontend application.

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Custom Hooks](#custom-hooks)
3. [Utility Functions](#utility-functions)
4. [Component API](#component-api)
5. [Type Definitions](#type-definitions)
6. [Error Handling](#error-handling)
7. [Performance Utilities](#performance-utilities)
8. [Testing Utilities](#testing-utilities)

## 🔌 API Overview

### Base Configuration

```typescript
// API Base Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
const API_TIMEOUT = 10000; // 10 seconds
```

### Request/Response Patterns

All API calls follow consistent patterns:

```typescript
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Error Handling

```typescript
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

## 🪝 Custom Hooks

### useStockData

Fetches and manages stock data for a given ticker symbol.

```typescript
interface UseStockDataOptions {
  /** Time range for data */
  readonly timeRange?: TimeRange;
  /** Custom start date */
  readonly startDate?: string;
  /** Custom end date */
  readonly endDate?: string;
  /** Whether to enable real-time updates */
  readonly realTime?: boolean;
  /** Polling interval in milliseconds */
  readonly pollInterval?: number;
}

interface UseStockDataReturn {
  /** Stock data */
  readonly data: SingleStockResponse | null;
  /** Loading state */
  readonly loading: boolean;
  /** Error state */
  readonly error: string | null;
  /** Refetch function */
  readonly refetch: () => Promise<void>;
  /** Last updated timestamp */
  readonly lastUpdated: Date | null;
}

function useStockData(
  ticker: string,
  options?: UseStockDataOptions
): UseStockDataReturn;
```

**Example Usage:**
```typescript
const { data, loading, error, refetch } = useStockData('AAPL', {
  timeRange: '1Y',
  realTime: true,
  pollInterval: 30000, // 30 seconds
});
```

### useDividendData

Manages dividend data fetching and processing.

```typescript
interface UseDividendDataOptions {
  /** Whether to include price data */
  readonly includePrices?: boolean;
  /** Time range for dividend data */
  readonly timeRange?: TimeRange;
}

interface UseDividendDataReturn {
  /** Dividend data */
  readonly dividendData: DividendData | null;
  /** Dividend markers for charts */
  readonly markers: DividendMarker[] | null;
  /** Loading state */
  readonly loading: boolean;
  /** Error state */
  readonly error: string | null;
  /** Fetch dividend data */
  readonly fetchDividendData: (
    ticker: string,
    timeRange?: TimeRange,
    startDate?: string,
    endDate?: string
  ) => Promise<void>;
  /** Update markers with price data */
  readonly updateMarkersWithPrices: (priceData: ApiTickerData[]) => void;
}

function useDividendDataWithPrices(
  priceData?: ApiTickerData[]
): UseDividendDataReturn;
```

### usePerformance

Tracks component performance metrics.

```typescript
interface UsePerformanceOptions {
  /** Component name for tracking */
  readonly componentName: string;
  /** Whether to track renders */
  readonly trackRenders?: boolean;
  /** Whether to track interactions */
  readonly trackInteractions?: boolean;
}

interface UsePerformanceReturn {
  /** Start timing measurement */
  readonly startTiming: (label: string) => void;
  /** End timing measurement */
  readonly endTiming: (label: string) => void;
  /** Record custom metric */
  readonly recordMetric: (name: string, value: number) => void;
  /** Get performance data */
  readonly getMetrics: () => PerformanceMetrics;
}

function usePerformance(options: UsePerformanceOptions): UsePerformanceReturn;
```

### useAccessibilityPreferences

Manages user accessibility preferences.

```typescript
interface AccessibilityPreferences {
  /** Reduced motion preference */
  readonly reduceMotion: boolean;
  /** High contrast mode */
  readonly highContrast: boolean;
  /** Font size preference */
  readonly fontSize: 'small' | 'medium' | 'large';
  /** Screen reader optimization */
  readonly screenReader: boolean;
}

interface UseAccessibilityPreferencesReturn {
  /** Current preferences */
  readonly preferences: AccessibilityPreferences;
  /** Update preferences */
  readonly updatePreferences: (updates: Partial<AccessibilityPreferences>) => void;
  /** Reset to defaults */
  readonly resetPreferences: () => void;
}

function useAccessibilityPreferences(): UseAccessibilityPreferencesReturn;
```

## 🛠 Utility Functions

### API Utilities

```typescript
/**
 * Makes an authenticated API request with timeout and error handling
 */
function apiRequest<T>(
  endpoint: string,
  options?: {
    readonly method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    readonly body?: unknown;
    readonly headers?: Record<string, string>;
    readonly timeout?: number;
    readonly signal?: AbortSignal;
  }
): Promise<ApiResponse<T>>;

/**
 * Fetches stock data for a single ticker
 */
function fetchStockData(
  ticker: string,
  timeRange?: TimeRange
): Promise<SingleStockResponse>;

/**
 * Fetches dividend data for a ticker
 */
function fetchDividendData(
  ticker: string,
  startDate?: string,
  endDate?: string
): Promise<DividendData>;
```

### Chart Utilities

```typescript
/**
 * Transforms API data to Nivo chart format
 */
function transformToNivoFormat(
  data: ApiTickerData[],
  priceField: PriceField,
  seriesId: string
): NivoChartData[];

/**
 * Downsamples data for performance
 */
function downsampleData(
  data: ApiTickerData[],
  maxPoints: number
): ApiTickerData[];

/**
 * Calculates price change metrics
 */
function calculatePriceChange(data: ApiTickerData[]): PriceChangeMetrics | null;

/**
 * Formats price values for display
 */
function formatPrice(value: number): string;

/**
 * Formats dates for chart display
 */
function formatChartDate(date: Date, dataLength: number): string;
```

### Performance Utilities

```typescript
/**
 * Debounces a function call
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T;

/**
 * Throttles a function call
 */
function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T;

/**
 * Measures function execution time
 */
function measurePerformance<T>(
  fn: () => T,
  label?: string
): T;

/**
 * Creates a memory-efficient cache
 */
function createCache<K, V>(maxSize: number): {
  get: (key: K) => V | undefined;
  set: (key: K, value: V) => void;
  clear: () => void;
  size: () => number;
};
```

### Accessibility Utilities

```typescript
/**
 * Checks if user prefers reduced motion
 */
function prefersReducedMotion(): boolean;

/**
 * Announces text to screen readers
 */
function announceToScreenReader(
  message: string,
  priority?: 'polite' | 'assertive'
): void;

/**
 * Calculates color contrast ratio
 */
function getContrastRatio(color1: string, color2: string): number;

/**
 * Validates color contrast for WCAG compliance
 */
function meetsContrastRequirements(
  foreground: string,
  background: string,
  level?: 'AA' | 'AAA'
): boolean;
```

## 🎨 Component API

### StockChart

Primary chart component for displaying stock price data.

```typescript
interface StockChartProps {
  /** Stock price data */
  readonly data: ApiTickerData[];
  /** Stock ticker symbol */
  readonly ticker?: string;
  /** Chart height */
  readonly height?: string | number;
  /** Chart type */
  readonly chartType?: 'line' | 'area';
  /** Loading state */
  readonly loading?: boolean;
  /** Error message */
  readonly error?: string;
  /** Show grid lines */
  readonly showGrid?: boolean;
  /** Enable crosshair */
  readonly enableCrosshair?: boolean;
  /** Maximum data points to render */
  readonly maxDataPoints?: number;
  /** Price field to display */
  readonly priceField?: 'Open' | 'High' | 'Low' | 'Close';
  /** Additional CSS classes */
  readonly className?: string;
  /** Enable dividend overlay */
  readonly enableDividends?: boolean;
  /** Dividend overlay options */
  readonly dividendOverlay?: DividendOverlayOptions;
  /** Time range for data */
  readonly timeRange?: TimeRange;
  /** Dividend toggle callback */
  readonly onDividendToggle?: (enabled: boolean) => void;
}
```

### StockHeader

Displays stock header information with price and metrics.

```typescript
interface StockHeaderProps {
  /** Stock data */
  readonly stockData: SingleStockResponse;
}
```

### TabNavigation

Accessible tab navigation component.

```typescript
interface TabNavigationProps {
  /** Currently active tab */
  readonly activeTab: TabId;
  /** Available tabs */
  readonly tabs: readonly TabItem[];
  /** Tab change callback */
  readonly onTabChange: (tabId: TabId) => void;
}
```

### ErrorBoundary

Advanced error boundary with recovery mechanisms.

```typescript
interface ErrorBoundaryProps {
  /** Child components */
  readonly children: ReactNode;
  /** Error severity level */
  readonly severity?: ErrorSeverity;
  /** Custom fallback component */
  readonly fallback?: React.ComponentType<ErrorFallbackProps>;
  /** Enable error reporting */
  readonly enableReporting?: boolean;
  /** Custom error handler */
  readonly onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show retry functionality */
  readonly showRetry?: boolean;
  /** Component context name */
  readonly context?: string;
}
```

## 📝 Type Definitions

### Core Types

```typescript
type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'ALL';

type TabId = 'overview' | 'charts' | 'dividends' | 'performance' | 'financials';

type PriceField = 'Open' | 'High' | 'Low' | 'Close';

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface ApiTickerData {
  readonly Date: string;
  readonly Open?: number;
  readonly High?: number;
  readonly Low?: number;
  readonly Close?: number;
  readonly Volume?: number;
}

interface SingleStockResponse {
  readonly symbol: string;
  readonly company_name?: string;
  readonly current_price?: number;
  readonly price_change?: number;
  readonly price_change_percent?: number;
  readonly market_cap?: number;
  readonly pe_ratio?: number;
  readonly dividend_yield?: number;
  readonly fifty_two_week_high?: number;
  readonly fifty_two_week_low?: number;
  readonly data: ApiTickerData[];
  readonly date_range?: {
    readonly start: string;
    readonly end: string;
  };
  readonly dividend_data?: DividendData;
}

interface DividendData {
  readonly dividend_count: number;
  readonly total_dividends: number;
  readonly dividends: DividendRecord[];
  readonly count?: number;
  readonly total?: number;
  readonly markers?: DividendMarker[];
}

interface DividendRecord {
  readonly ex_date: string;
  readonly dividend_amount: number;
  readonly dividend_type?: string;
}

interface DividendMarker {
  readonly x: Date | number;
  readonly y: number;
  readonly amount: number;
  readonly date: string;
}
```

### Component Props Types

```typescript
interface TabItem {
  readonly id: TabId;
  readonly label: string;
  readonly icon: string;
}

interface DividendOverlayOptions {
  readonly show: boolean;
  readonly showMarkers?: boolean;
  readonly showTooltips?: boolean;
  readonly markerSize?: number;
  readonly markerColor?: string;
}

interface PerformanceMetrics {
  readonly componentName: string;
  readonly renderCount: number;
  readonly averageRenderTime: number;
  readonly totalRenderTime: number;
  readonly interactionCount: number;
  readonly customMetrics: Record<string, number>;
}
```

## ⚠️ Error Handling

### Structured Error Types

```typescript
interface StructuredError {
  readonly code: string;
  readonly message: string;
  readonly severity: ErrorSeverity;
  readonly category: ErrorCategory;
  readonly context?: Record<string, unknown>;
  readonly originalError?: Error;
  readonly timestamp: string;
  readonly recoveryActions?: readonly string[];
}

type ErrorCategory = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'business'
  | 'system'
  | 'unknown';
```

### Error Utilities

```typescript
/**
 * Creates a structured error
 */
function createStructuredError(
  code: string,
  message: string,
  severity?: ErrorSeverity,
  category?: ErrorCategory,
  context?: Record<string, unknown>,
  originalError?: Error
): StructuredError;

/**
 * Global error handler
 */
class ErrorHandler {
  handle(error: StructuredError): void;
  createAndHandle(
    code: string,
    message: string,
    severity?: ErrorSeverity,
    category?: ErrorCategory,
    context?: Record<string, unknown>,
    originalError?: Error
  ): StructuredError;
}

/**
 * Result wrapper for operations that can fail
 */
type Result<T, E = StructuredError> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Wraps async functions to return Result type
 */
function wrapAsync<T, A extends readonly unknown[]>(
  fn: (...args: A) => Promise<T>
): (...args: A) => Promise<Result<T>>;
```

## ⚡ Performance Utilities

### Memory Management

```typescript
/**
 * Memory manager for large datasets
 */
interface MemoryManager {
  /** Track memory usage */
  trackUsage(component: string, size: number): void;
  /** Get memory statistics */
  getStats(): MemoryStats;
  /** Clear memory for component */
  clear(component: string): void;
  /** Get memory warnings */
  getWarnings(): MemoryWarning[];
}

interface MemoryStats {
  readonly totalAllocated: number;
  readonly componentsTracked: number;
  readonly largestComponent: string;
  readonly recommendations: string[];
}
```

### Performance Monitoring

```typescript
/**
 * Performance profiler
 */
interface PerformanceProfiler {
  /** Start profiling session */
  startSession(sessionId: string): void;
  /** End profiling session */
  endSession(sessionId: string): PerformanceReport;
  /** Mark performance point */
  mark(name: string): void;
  /** Measure between marks */
  measure(name: string, startMark: string, endMark: string): number;
}

interface PerformanceReport {
  readonly sessionId: string;
  readonly duration: number;
  readonly marks: PerformanceMark[];
  readonly measures: PerformanceMeasure[];
  readonly recommendations: string[];
}
```

## 🧪 Testing Utilities

### Test Helpers

```typescript
/**
 * Renders component with providers
 */
function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
): RenderResult;

/**
 * Creates mock stock data
 */
function createMockStockData(
  overrides?: Partial<SingleStockResponse>
): SingleStockResponse;

/**
 * Waits for async operations to complete
 */
function waitForAsyncOperations(): Promise<void>;

/**
 * Simulates user interactions
 */
function simulateUserInteraction(
  element: HTMLElement,
  interaction: UserInteraction
): Promise<void>;
```

### Accessibility Testing

```typescript
/**
 * Runs accessibility audit on component
 */
function auditAccessibility(
  container: HTMLElement
): Promise<AccessibilityAuditResult>;

/**
 * Tests keyboard navigation
 */
function testKeyboardNavigation(
  container: HTMLElement,
  navigationPath: KeyboardAction[]
): Promise<NavigationResult>;
```

---

## 📖 Usage Examples

### Basic Stock Chart Implementation

```typescript
import { StockChart } from '@/components/StockChart';
import { useStockData } from '@/hooks/useStockData';

function MyStockChart({ ticker }: { ticker: string }) {
  const { data, loading, error } = useStockData(ticker, {
    timeRange: '1Y',
    realTime: true,
  });

  return (
    <StockChart
      data={data?.data || []}
      ticker={ticker}
      loading={loading}
      error={error}
      height="400px"
      enableDividends
      chartType="line"
      showGrid
      enableCrosshair
    />
  );
}
```

### Error Handling Example

```typescript
import { wrapAsync, ErrorUtils } from '@/utils/errorHandling';

const fetchDataSafely = wrapAsync(async (ticker: string) => {
  const response = await fetch(`/api/stocks/${ticker}`);
  if (!response.ok) {
    throw ErrorUtils.networkError('Failed to fetch stock data', {
      ticker,
      status: response.status,
    });
  }
  return response.json();
});

// Usage
const result = await fetchDataSafely('AAPL');
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error.message);
}
```

### Performance Monitoring Example

```typescript
import { usePerformance } from '@/hooks/usePerformance';

function MyComponent() {
  const { startTiming, endTiming, recordMetric } = usePerformance({
    componentName: 'MyComponent',
    trackRenders: true,
  });

  useEffect(() => {
    startTiming('data-processing');
    // ... expensive operation
    endTiming('data-processing');
    
    recordMetric('items-processed', 1000);
  }, []);

  return <div>Component content</div>;
}
```

For more detailed examples and advanced usage patterns, see the [component stories](http://localhost:6006) and [test files](../src/**/*.test.tsx).