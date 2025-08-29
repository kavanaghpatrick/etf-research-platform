// TypeScript interfaces for stock detail page data structures

export interface StockDataPoint {
  Date: string
  Open?: number
  High?: number
  Low?: number
  Close?: number
  Volume?: number
}

export interface DateRange {
  start: string
  end: string
}

export interface StockData {
  data: StockDataPoint[]
  date_range: DateRange
}

export interface DividendPayment {
  ex_date?: string
  dividend_amount?: number
  dividend_type?: string
}

export interface DividendData {
  total_dividends: number
  dividend_count: number
  dividends: DividendPayment[]
}

export interface SourceHealth {
  name: string
  healthy: boolean
  success_rate: string
  total_requests: number
  average_response_time: string
}

export interface StockMetadata {
  total_tickers: number
  successful_tickers: number
  failed_tickers: number
  success_rate: number
  execution_time: number
  data_sources_used: string[]
  failed_ticker_list: string[]
  cache_hit_rate?: number
}

export interface StockResponse {
  data: { [symbol: string]: StockData }
  metadata: StockMetadata
  source_health: SourceHealth[]
  dividend_data?: { [symbol: string]: DividendData }
}

export interface SingleStockResponse {
  symbol: string
  data: StockDataPoint[]
  date_range: DateRange
  dividend_data?: DividendData
  company_name?: string
  current_price?: number
  price_change?: number
  price_change_percent?: number
  market_cap?: number
  pe_ratio?: number
  dividend_yield?: number
  fifty_two_week_high?: number
  fifty_two_week_low?: number
}

export interface StockPageParams {
  symbol: string
}


export type TabId = 'overview' | 'charts' | 'dividends' | 'performance' | 'financials'

export interface TabItem {
  id: TabId
  label: string
  icon: string
}

// Extended types for chart integration and data fetching
export type TimeRange = '1D' | '5D' | '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX' | 'CUSTOM'

export interface TimeRangeConfig {
  label: string
  value: TimeRange
  days?: number
  isDefault?: boolean
}

export interface StockDataOptions {
  tickers: string[]
  start_date: string
  end_date: string
  force_refresh?: boolean
  include_dividends?: boolean
  max_workers?: number
}

export interface StockDataResponse {
  data: { [symbol: string]: StockData }
  metadata: StockMetadata
  source_health: SourceHealth[]
  dividend_data?: { [symbol: string]: DividendData }
}

export interface UseStockDataResult {
  data: StockDataResponse | null
  loading: boolean
  error: string | null
  lastFetched: Date | null
  refetch: () => Promise<void>
}

export type StockDataErrorType = 'NETWORK_ERROR' | 'API_ERROR' | 'INVALID_TICKER' | 'TIMEOUT' | 'UNKNOWN'

export interface StockDataError {
  type: StockDataErrorType
  message: string
  timestamp: Date
}

export interface StockDataErrorInfo {
  type: StockDataErrorType
  message: string
  details?: unknown
}

// Dividend visualization types
export interface DividendMarker {
  date: string
  amount: number
  type: string
  x: number | Date
  y: number
}

export interface DividendOverlayOptions {
  show: boolean
  showMarkers: boolean
  showTooltips: boolean
  markerSize?: number
  markerColor?: string
}

export interface DividendVisualizationData {
  dividends: DividendPayment[]
  markers: DividendMarker[]
  total: number
  count: number
}