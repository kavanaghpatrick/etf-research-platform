/**
 * Utility functions for consistent data formatting across the application
 */

/**
 * Format currency values with consistent decimal places
 */
export function formatCurrency(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return `$${value.toFixed(decimals)}`
}

/**
 * Format large numbers with appropriate units (K, M, B, T)
 */
export function formatLargeNumber(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }

  const absValue = Math.abs(value)
  
  if (absValue >= 1e12) {
    return `${(value / 1e12).toFixed(decimals)}T`
  } else if (absValue >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`
  } else if (absValue >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`
  } else if (absValue >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`
  } else {
    return value.toFixed(decimals)
  }
}

/**
 * Format percentage values consistently
 */
export function formatPercentage(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Format volume numbers with commas
 */
export function formatVolume(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return value.toLocaleString()
}

/**
 * Format date consistently
 */
export function formatDate(date: string | Date | undefined | null): string {
  if (!date) {
    return 'N/A'
  }
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return 'N/A'
  }
}

/**
 * Format market cap consistently
 */
export function formatMarketCap(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return `$${formatLargeNumber(value)}`
}

/**
 * Get color class for positive/negative values
 */
export function getValueColorClass(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'text-gray-600'
  }
  return value >= 0 ? 'text-green-600' : 'text-red-600'
}

/**
 * Format ratio values (P/E, etc.)
 */
export function formatRatio(value: number | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null || isNaN(value)) {
    return 'N/A'
  }
  return value.toFixed(decimals)
}