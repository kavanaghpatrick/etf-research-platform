'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { DividendData, DividendVisualizationData, DividendMarker, TimeRange } from '@/types/stock'
import { calculateStartDate, calculateEndDate } from '@/utils/timeRange'
import { apiRequest, API_ENDPOINTS, createApiError, createTimeoutController, cleanupRequest, debounce } from '@/utils/api'

interface DividendDataResponse {
  status: string
  timestamp: string
  ticker: string | null
  data: {
    ticker: string
    dividends: Array<{
      ex_date: string
      dividend_amount: number
      dividend_type: string
    }>
  }
  metadata: any | null
  execution_time: number
}

export interface UseDividendDataResult {
  dividendData: DividendVisualizationData | null
  loading: boolean
  error: string | null
  lastFetched: Date | null
  fetchDividendData: (ticker: string, timeRange?: TimeRange, customStart?: string, customEnd?: string) => Promise<void>
  clearError: () => void
  retry: () => Promise<void>
  cancel: () => void
  clearCache: () => void
}

/**
 * Transform dividend markers for chart visualization
 */
function transformDividendsToMarkers(
  dividends: Array<{ ex_date?: string; dividend_amount?: number; dividend_type?: string }>,
  priceData?: Array<{ Date: string; Close: number }>
): DividendMarker[] {
  if (!dividends || dividends.length === 0) {
    console.log('[transformDividendsToMarkers] No dividends to transform')
    return []
  }
  
  console.log('[transformDividendsToMarkers] Transforming dividends:', {
    dividendsCount: dividends.length,
    hasPriceData: !!priceData,
    priceDataCount: priceData?.length || 0
  })

  const result = dividends
    .filter((dividend) => dividend.ex_date && dividend.dividend_amount && dividend.dividend_type)
    .map((dividend) => {
      const dividendDateStr = dividend.ex_date!.split('T')[0]
      const pricePoint = priceData?.find(
        (point) => point.Date.split('T')[0] === dividendDateStr
      )
      
      let closestPrice = pricePoint?.Close
      if (!closestPrice && priceData && priceData.length > 0) {
        const dividendDate = new Date(dividendDateStr)
        const sortedPrices = [...priceData].sort((a, b) => 
          new Date(a.Date).getTime() - new Date(b.Date).getTime()
        )
        
        const nextTradingDay = sortedPrices.find(
          (point) => new Date(point.Date) >= dividendDate
        )
        
        if (nextTradingDay) {
          closestPrice = nextTradingDay.Close
        } else {
          closestPrice = sortedPrices[sortedPrices.length - 1].Close
        }
      }
      
      return {
        date: dividend.ex_date!,
        amount: dividend.dividend_amount!,
        type: dividend.dividend_type!,
        x: new Date(dividendDateStr),
        y: closestPrice || 0,
      }
    })
    .filter((marker) => marker.y > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
  console.log('[transformDividendsToMarkers] Final result:', {
    totalDividends: dividends.length,
    validDividends: dividends.filter(d => d.ex_date && d.dividend_amount && d.dividend_type).length,
    markersWithPrices: result.length,
    firstMarkers: result.slice(0, 3).map(m => ({
      date: m.date,
      amount: m.amount,
      x: m.x,
      y: m.y
    }))
  })
  
  return result
}

/**
 * Custom hook for fetching and managing dividend data
 */
export function useDividendData(): UseDividendDataResult {
  const [dividendData, setDividendData] = useState<DividendVisualizationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  
  // Store last request parameters for retry functionality
  const lastRequestRef = useRef<{
    ticker: string
    timeRange?: TimeRange
    customStart?: string
    customEnd?: string
  } | null>(null)
  
  // AbortController for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Cache for avoiding unnecessary API calls
  const cacheRef = useRef<Map<string, { data: DividendVisualizationData; timestamp: number }>>(new Map())
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Generate cache key for the request
   */
  const getCacheKey = useCallback((ticker: string, startDate?: string, endDate?: string, years?: number): string => {
    return JSON.stringify({
      ticker: ticker.toUpperCase(),
      start_date: startDate,
      end_date: endDate,
      years: years,
    })
  }, [])

  /**
   * Get cached data if available and not expired
   */
  const getCachedData = useCallback((cacheKey: string): DividendVisualizationData | null => {
    const cached = cacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }
    return null
  }, [])

  /**
   * Set data in cache
   */
  const setCachedData = useCallback((cacheKey: string, data: DividendVisualizationData): void => {
    cacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
  }, [])

  /**
   * Fetch dividend data from API with timeout and proper cleanup
   */
  const fetchFromAPI = useCallback(async (ticker: string, years?: number): Promise<DividendDataResponse> => {
    // Cancel any previous request and cleanup
    if (abortControllerRef.current) {
      cleanupRequest(abortControllerRef.current)
      abortControllerRef.current = null
    }
    
    // Build URL with years parameter if provided
    const baseUrl = API_ENDPOINTS.DIVIDENDS(ticker.toUpperCase())
    const url = years ? `${baseUrl}?years=${years}` : baseUrl
    
    console.log('[fetchFromAPI] Fetching dividends:', { ticker, years, url })
    
    // Use centralized API request with timeout
    const data = await apiRequest<DividendDataResponse>(
      url,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 second timeout
        retries: 2, // Retry failed requests
      }
    )
    
    return data
  }, [])

  /**
   * Main fetch function with debouncing
   */
  const fetchDividendDataInternal = useCallback(async (
    ticker: string,
    timeRange?: TimeRange,
    customStart?: string,
    customEnd?: string
  ): Promise<void> => {
    if (!ticker || ticker.trim() === '') {
      setError('Please provide a ticker symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Calculate date range and years parameter based on timeRange
      const startDate = timeRange ? calculateStartDate(timeRange, customStart, 1) : undefined // Single ticker for dividend hook
      const endDate = timeRange ? calculateEndDate(timeRange, customEnd) : undefined
      
      // Convert timeRange to years parameter for the API
      let years: number | undefined
      if (timeRange) {
        switch (timeRange) {
          case '1D':
          case '5D':
          case '1M':
          case '3M':
          case '6M':
            years = 1 // For short ranges, get 1 year to ensure we have dividend context
            break
          case '1Y':
            years = 2 // Get 2 years for 1Y range to ensure coverage
            break
          case '5Y':
            years = 6 // Get 6 years for 5Y range to ensure full coverage
            break
          case 'MAX':
            years = 20 // Maximum allowed by the API
            break
          default:
            years = 5 // Default fallback
        }
      }

      // Store request parameters for retry
      lastRequestRef.current = { ticker, timeRange, customStart, customEnd }

      // Check cache first (include years in cache key)
      const cacheKey = getCacheKey(ticker, startDate, endDate, years)
      const cachedData = getCachedData(cacheKey)
      
      if (cachedData) {
        setDividendData(cachedData)
        setLastFetched(new Date())
        setLoading(false)
        return
      }

      // Fetch from API with years parameter
      console.log('[useDividendData] Fetching dividend data from API for:', { ticker, timeRange, years })
      const responseData = await fetchFromAPI(ticker, years)
      
      if (responseData.status !== 'success') {
        throw new Error('Failed to fetch dividend data')
      }
      
      console.log('[useDividendData] API response:', {
        status: responseData.status,
        dividendsCount: responseData.data?.dividends?.length || 0,
        firstDividends: responseData.data?.dividends?.slice(0, 3) || []
      })

      // Use dividend data as-is when years parameter was used (API already filtered by time)
      // Only apply additional date filtering for custom date ranges without years parameter
      let filteredDividends = responseData.data.dividends
      console.log('[useDividendData] Raw dividend data from API:', {
        totalDividends: responseData.data.dividends.length,
        firstFew: responseData.data.dividends.slice(0, 5).map(d => ({ date: d.ex_date, amount: d.dividend_amount })),
        lastFew: responseData.data.dividends.slice(-5).map(d => ({ date: d.ex_date, amount: d.dividend_amount })),
        dateRange: { startDate, endDate },
        years,
        usingYearsParameter: !!years
      })
      
      // Only filter by date range if we're NOT using the years parameter
      // (because years parameter means API already filtered the correct time range)
      if (startDate && endDate && !years) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        const beforeFilter = filteredDividends.length
        filteredDividends = responseData.data.dividends.filter(dividend => {
          const dividendDate = new Date(dividend.ex_date)
          return dividendDate >= start && dividendDate <= end
        })
        console.log('[useDividendData] Date filtering results (custom range):', {
          beforeFilter,
          afterFilter: filteredDividends.length,
          startDate,
          endDate,
          filteredFirst: filteredDividends.slice(0, 3).map(d => ({ date: d.ex_date, amount: d.dividend_amount })),
          filteredLast: filteredDividends.slice(-3).map(d => ({ date: d.ex_date, amount: d.dividend_amount }))
        })
      } else if (years) {
        console.log('[useDividendData] Using all dividends from API (years parameter used):', {
          years,
          totalDividends: filteredDividends.length,
          dateSpan: filteredDividends.length > 0 ? {
            from: filteredDividends[filteredDividends.length - 1]?.ex_date,
            to: filteredDividends[0]?.ex_date
          } : null
        })
      }

      // Transform to visualization data
      const markers = transformDividendsToMarkers(filteredDividends)
      console.log('[useDividendData] Transformed markers (without prices):', {
        markersCount: markers.length,
        firstMarkers: markers.slice(0, 3)
      })
      
      const visualizationData: DividendVisualizationData = {
        dividends: filteredDividends,
        markers: markers,
        total: filteredDividends.reduce((sum, d) => sum + d.dividend_amount, 0),
        count: filteredDividends.length,
      }
      
      // Cache the response
      setCachedData(cacheKey, visualizationData)
      
      setDividendData(visualizationData)
      setLastFetched(new Date())
    } catch (err) {
      const errorInfo = createApiError(err)
      setError(errorInfo.message)
      setDividendData(null)
      
      // Log structured error information
      console.error('Dividend data fetch error:', {
        ticker,
        type: errorInfo.type,
        message: errorInfo.message,
        timestamp: new Date(errorInfo.timestamp).toISOString()
      })
    } finally {
      setLoading(false)
      // Ensure cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }
    }
  }, [fetchFromAPI, getCacheKey, getCachedData, setCachedData])
  
  // Debounced version to prevent rapid API calls
  const debouncedFetch = useCallback(debounce(fetchDividendDataInternal, 300), [fetchDividendDataInternal])
  const fetchDividendData = useCallback(debouncedFetch, [debouncedFetch])

  /**
   * Retry last request
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!lastRequestRef.current) {
      setError('No previous request to retry')
      return
    }

    const { ticker, timeRange, customStart, customEnd } = lastRequestRef.current
    await fetchDividendData(ticker, timeRange, customStart, customEnd)
  }, [fetchDividendData])

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  /**
   * Cancel ongoing request with proper cleanup
   */
  const cancel = useCallback((): void => {
    if (abortControllerRef.current) {
      cleanupRequest(abortControllerRef.current)
      abortControllerRef.current = null
      setLoading(false)
    }
  }, [])

  /**
   * Clear dividend cache - useful when switching time ranges
   */
  const clearCache = useCallback((): void => {
    cacheRef.current.clear()
    console.log('[useDividendData] Cache cleared')
  }, [])
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        cleanupRequest(abortControllerRef.current)
        abortControllerRef.current = null
      }
    }
  }, [])

  return {
    dividendData,
    loading,
    error,
    lastFetched,
    fetchDividendData,
    clearError,
    retry,
    cancel,
    clearCache
  }
}

/**
 * Enhanced hook that integrates dividend data with price data for marker positioning
 */
export function useDividendDataWithPrices(
  priceData?: Array<{ Date: string; Close: number }>
): UseDividendDataResult & {
  updateMarkersWithPrices: (priceData: Array<{ Date: string; Close: number }>) => void
} {
  const dividendHook = useDividendData()
  
  /**
   * Update dividend markers with current price data
   */
  const updateMarkersWithPrices = useCallback((
    priceData: Array<{ Date: string; Close: number }>
  ): void => {
    if (!dividendHook.dividendData) {
      console.log('[useDividendDataWithPrices] No dividend data to update')
      return
    }
    
    console.log('[useDividendDataWithPrices] Updating markers with price data:', {
      dividendsCount: dividendHook.dividendData.dividends.length,
      priceDataCount: priceData.length,
      priceDataRange: priceData.length > 0 ? {
        start: priceData[0].Date,
        end: priceData[priceData.length - 1].Date
      } : null
    })
    
    const updatedMarkers = transformDividendsToMarkers(
      dividendHook.dividendData.dividends,
      priceData
    )
    
    console.log('[useDividendDataWithPrices] Updated markers with prices:', {
      updatedMarkersCount: updatedMarkers.length,
      markersWithValidPrices: updatedMarkers.filter(m => m.y > 0).length,
      firstUpdatedMarkers: updatedMarkers.slice(0, 3)
    })
    
    const updatedData: DividendVisualizationData = {
      ...dividendHook.dividendData,
      markers: updatedMarkers,
    }
    
    // Update the dividend data with new markers
    dividendHook.dividendData && Object.assign(dividendHook.dividendData, updatedData)
  }, [dividendHook.dividendData])

  return {
    ...dividendHook,
    updateMarkersWithPrices,
  }
}