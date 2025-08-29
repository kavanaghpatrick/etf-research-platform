import { TimeRange, TimeRangeConfig } from '@/types/stock'

// Time range configurations with labels and default behavior
export const TIME_RANGE_CONFIGS: TimeRangeConfig[] = [
  { label: '1D', value: '1D', days: 1 },
  { label: '5D', value: '5D', days: 5 },
  { label: '1M', value: '1M', days: 30 },
  { label: '3M', value: '3M', days: 90 },
  { label: '6M', value: '6M', days: 180, isDefault: true },
  { label: '1Y', value: '1Y', days: 365 },
  { label: '5Y', value: '5Y', days: 1825 },
  { label: 'MAX', value: 'MAX', description: 'Maximum available data (optimized for multiple tickers)' },
  { label: 'Custom', value: 'CUSTOM' }
]

/**
 * Calculate start date based on time range
 * @param timeRange - The selected time range
 * @param customStartDate - Custom start date for CUSTOM range
 * @param tickerCount - Number of tickers being requested (for MAX optimization)
 * @returns ISO date string for start date
 */
export function calculateStartDate(
  timeRange: TimeRange, 
  customStartDate?: string,
  tickerCount?: number
): string {
  const today = new Date()
  
  if (timeRange === 'CUSTOM' && customStartDate) {
    return customStartDate
  }
  
  if (timeRange === 'MAX') {
    // For MAX, use a reasonable date based on number of tickers
    // More tickers = shorter time range to avoid API timeouts
    const maxDate = new Date()
    
    if (tickerCount === undefined || tickerCount <= 1) {
      // Single ticker scenario - use full historical data (20+ years)
      const yearsBack = 20
      maxDate.setFullYear(maxDate.getFullYear() - yearsBack)
      console.log(`[MAX Range] Single ticker: using ${yearsBack} years back`)
      return maxDate.toISOString().split('T')[0]
    } else if (tickerCount <= 4) {
      // Few tickers - use 10 years
      const yearsBack = 10
      maxDate.setFullYear(maxDate.getFullYear() - yearsBack)
      console.log(`[MAX Range] ${tickerCount} tickers: using ${yearsBack} years back`)
      return maxDate.toISOString().split('T')[0]
    } else {
      // Many tickers - use scaled approach to avoid timeouts
      const yearsBack = Math.max(2, Math.min(5, Math.floor(10 / tickerCount)))
      maxDate.setFullYear(maxDate.getFullYear() - yearsBack)
      console.log(`[MAX Range] ${tickerCount} tickers: using ${yearsBack} years back`)
      return maxDate.toISOString().split('T')[0]
    }
  }
  
  const config = TIME_RANGE_CONFIGS.find(c => c.value === timeRange)
  if (!config || !config.days) {
    // Default to 6 months if no valid config found
    const defaultDate = new Date()
    defaultDate.setMonth(defaultDate.getMonth() - 6)
    return defaultDate.toISOString().split('T')[0]
  }
  
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - config.days)
  
  // For 1D, we need to handle weekends and get the last trading day
  if (timeRange === '1D') {
    const dayOfWeek = startDate.getDay()
    if (dayOfWeek === 0) { // Sunday
      startDate.setDate(startDate.getDate() - 2)
    } else if (dayOfWeek === 6) { // Saturday
      startDate.setDate(startDate.getDate() - 1)
    }
  }
  
  return startDate.toISOString().split('T')[0]
}

/**
 * Calculate end date based on time range
 * @param timeRange - The selected time range
 * @param customEndDate - Custom end date for CUSTOM range
 * @returns ISO date string for end date
 */
export function calculateEndDate(
  timeRange: TimeRange,
  customEndDate?: string
): string {
  if (timeRange === 'CUSTOM' && customEndDate) {
    return customEndDate
  }
  
  // Get the most recent potential trading day
  // Start with today and work backwards to find the most recent trading day
  const today = new Date()
  let endDate = new Date(today)
  
  // Helper function to check if a date is a weekend
  const isWeekend = (date: Date) => {
    const day = date.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }
  
  // Find the most recent trading day (accounting for weekends)
  // If today is a weekend, go back to Friday
  // If today is a weekday, we can use today (backend will handle if data isn't available yet)
  while (isWeekend(endDate)) {
    endDate.setDate(endDate.getDate() - 1)
  }
  
  // For intraday ranges (1D), be more conservative and use the previous trading day
  // to avoid issues with incomplete data or market hours
  if (timeRange === '1D') {
    endDate.setDate(endDate.getDate() - 1)
    // Make sure we still have a trading day after going back
    while (isWeekend(endDate)) {
      endDate.setDate(endDate.getDate() - 1)
    }
  }
  
  return endDate.toISOString().split('T')[0]
}

/**
 * Get the default time range
 * @returns Default time range value
 */
export function getDefaultTimeRange(): TimeRange {
  return TIME_RANGE_CONFIGS.find(c => c.isDefault)?.value || '6M'
}

/**
 * Get time range configuration by value
 * @param timeRange - Time range value
 * @returns Time range configuration or undefined
 */
export function getTimeRangeConfig(timeRange: TimeRange): TimeRangeConfig | undefined {
  return TIME_RANGE_CONFIGS.find(c => c.value === timeRange)
}

/**
 * Validate if a time range is valid
 * @param timeRange - Time range to validate
 * @returns Boolean indicating validity
 */
export function isValidTimeRange(timeRange: string): timeRange is TimeRange {
  return TIME_RANGE_CONFIGS.some(c => c.value === timeRange)
}

/**
 * Format date range for display
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }
  
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}

/**
 * Check if dates represent an intraday range
 * @param startDate - Start date string
 * @param endDate - End date string
 * @returns Boolean indicating if this is an intraday range
 */
export function isIntradayRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffInDays = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return diffInDays <= 1
}

/**
 * Get appropriate data interval based on time range
 * @param timeRange - Selected time range
 * @returns Data interval (daily, weekly, monthly)
 */
export function getDataInterval(timeRange: TimeRange): 'daily' | 'weekly' | 'monthly' {
  switch (timeRange) {
    case '1D':
    case '5D':
      return 'daily'
    case '1M':
    case '3M':
    case '6M':
      return 'daily'
    case '1Y':
      return 'weekly'
    case '5Y':
    case 'MAX':
      return 'monthly'
    case 'CUSTOM':
      return 'daily' // Default to daily for custom ranges
    default:
      return 'daily'
  }
}

/**
 * Get the most recent trading day, accounting for weekends and common market holidays
 * This provides a more robust fallback when current date selection fails
 * @param fromDate - Starting point to work backwards from (defaults to today)
 * @returns Most recent likely trading day
 */
export function getMostRecentTradingDay(fromDate?: Date): string {
  const date = fromDate ? new Date(fromDate) : new Date()
  
  // Helper function to check if a date is a weekend
  const isWeekend = (checkDate: Date) => {
    const day = checkDate.getDay()
    return day === 0 || day === 6 // Sunday or Saturday
  }
  
  // Helper function to check for common US market holidays (simplified)
  const isLikelyMarketHoliday = (checkDate: Date) => {
    const month = checkDate.getMonth() + 1 // getMonth() is 0-indexed
    const dayOfMonth = checkDate.getDate()
    
    // New Year's Day
    if (month === 1 && dayOfMonth === 1) return true
    
    // Independence Day
    if (month === 7 && dayOfMonth === 4) return true
    
    // Christmas Day
    if (month === 12 && dayOfMonth === 25) return true
    
    // Thanksgiving (4th Thursday in November) - simplified check
    if (month === 11 && dayOfMonth >= 22 && dayOfMonth <= 28 && checkDate.getDay() === 4) return true
    
    return false
  }
  
  // Work backwards to find a likely trading day
  let tradingDay = new Date(date)
  let attempts = 0
  const maxAttempts = 10 // Prevent infinite loops
  
  while ((isWeekend(tradingDay) || isLikelyMarketHoliday(tradingDay)) && attempts < maxAttempts) {
    tradingDay.setDate(tradingDay.getDate() - 1)
    attempts++
  }
  
  return tradingDay.toISOString().split('T')[0]
}

/**
 * Validate and adjust date range to ensure it's reasonable for market data
 * @param startDate - Start date string
 * @param endDate - End date string  
 * @returns Adjusted date range object
 */
export function validateAndAdjustDateRange(startDate: string, endDate: string): {
  startDate: string
  endDate: string
  warnings: string[]
} {
  const warnings: string[] = []
  let adjustedStart = startDate
  let adjustedEnd = endDate
  
  const start = new Date(startDate)
  const end = new Date(endDate)
  const today = new Date()
  
  // Check if end date is in the future
  if (end > today) {
    adjustedEnd = getMostRecentTradingDay()
    warnings.push('End date adjusted to most recent trading day (cannot fetch future data)')
  }
  
  // Check if start date is after end date
  if (start >= end) {
    // Adjust start date to be 30 days before end date
    const adjustedStartDate = new Date(end)
    adjustedStartDate.setDate(adjustedStartDate.getDate() - 30)
    adjustedStart = adjustedStartDate.toISOString().split('T')[0]
    warnings.push('Start date adjusted to be 30 days before end date')
  }
  
  // Check if date range is too narrow (less than 1 day)
  const rangeDays = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  if (rangeDays < 1 && !warnings.length) {
    warnings.push('Very narrow date range - may have limited data availability')
  }
  
  return {
    startDate: adjustedStart,
    endDate: adjustedEnd,
    warnings
  }
}