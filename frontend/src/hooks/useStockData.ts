'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { 
  StockDataResponse, 
  StockDataOptions, 
  UseStockDataResult, 
  StockDataError,
  StockDataErrorInfo,
  TimeRange 
} from '@/types/stock'
import { calculateStartDate, calculateEndDate } from '@/utils/timeRange'
import { apiRequest, API_ENDPOINTS, createApiError, cleanupRequest, debounce } from '@/utils/api'

/**
 * Custom hook for fetching stock data with error handling and caching
 */
export function useStockData(): UseStockDataResult & {
  fetchData: (tickers: string[], timeRange: TimeRange, customStart?: string, customEnd?: string) => Promise<void>
  clearError: () => void
  retry: () => Promise<void>
  cancel: () => void
} {
  const [data, setData] = useState<StockDataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  
  // Store last request parameters for retry functionality
  const lastRequestRef = useRef<{
    tickers: string[]
    timeRange: TimeRange
    customStart?: string
    customEnd?: string
  } | null>(null)
  
  // AbortController for canceling requests
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Cache for avoiding unnecessary API calls
  const cacheRef = useRef<Map<string, { data: StockDataResponse; timestamp: number }>>(new Map())
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  /**
   * Generate cache key for the request
   */
  const getCacheKey = useCallback((options: StockDataOptions): string => {
    return JSON.stringify({
      tickers: options.tickers.sort(),
      start_date: options.start_date,
      end_date: options.end_date,
      include_dividends: options.include_dividends
    })
  }, [])

  /**
   * Get cached data if available and not expired
   */
  const getCachedData = useCallback((cacheKey: string): StockDataResponse | null => {
    const cached = cacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }
    return null
  }, [])

  /**
   * Set data in cache
   */
  const setCachedData = useCallback((cacheKey: string, data: StockDataResponse): void => {
    cacheRef.current.set(cacheKey, {
      data,
      timestamp: Date.now()
    })
  }, [])

  // Remove the local handleError function as we'll use the centralized one

  /**
   * Fetch stock data from API with timeout and proper cleanup
   */
  const fetchStockData = useCallback(async (options: StockDataOptions): Promise<StockDataResponse> => {
    // Cancel any previous request and cleanup
    if (abortControllerRef.current) {
      cleanupRequest(abortControllerRef.current)
      abortControllerRef.current = null
    }
    
    // Use centralized API request with timeout
    const data = await apiRequest<StockDataResponse>(
      API_ENDPOINTS.FETCH_DATA,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        timeout: 10000, // 10 second timeout
        retries: 2, // Retry failed requests
      }
    )
    
    return data
  }, [])

  /**
   * Main fetch function with debouncing
   */
  const fetchDataInternal = useCallback(async (
    tickers: string[], 
    timeRange: TimeRange, 
    customStart?: string, 
    customEnd?: string
  ): Promise<void> => {
    if (tickers.length === 0) {
      setError('Please provide at least one ticker symbol')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const startDate = calculateStartDate(timeRange, customStart, tickers.length)
      const endDate = calculateEndDate(timeRange, customEnd)

      const options: StockDataOptions = {
        tickers,
        start_date: startDate,
        end_date: endDate,
        force_refresh: false,
        include_dividends: false,
        max_workers: 5
      }

      // Store request parameters for retry
      lastRequestRef.current = { tickers, timeRange, customStart, customEnd }

      // Check cache first
      const cacheKey = getCacheKey(options)
      const cachedData = getCachedData(cacheKey)
      
      if (cachedData) {
        setData(cachedData)
        setLastFetched(new Date())
        setLoading(false)
        return
      }

      // Fetch from API
      const responseData = await fetchStockData(options)
      
      // Cache the response
      setCachedData(cacheKey, responseData)
      
      setData(responseData)
      setLastFetched(new Date())
    } catch (err) {
      const errorInfo = createApiError(err)
      setError(errorInfo.message)
      setData(null)
      
      // Log structured error information
      console.error('Stock data fetch error:', {
        tickers,
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
  }, [fetchStockData, getCacheKey, getCachedData, setCachedData])
  
  // Debounced version to prevent rapid API calls
  const debouncedFetch = useCallback(debounce(fetchDataInternal, 300), [fetchDataInternal])
  const fetchData = useCallback(debouncedFetch, [debouncedFetch])

  /**
   * Retry last request
   */
  const retry = useCallback(async (): Promise<void> => {
    if (!lastRequestRef.current) {
      setError('No previous request to retry')
      return
    }

    const { tickers, timeRange, customStart, customEnd } = lastRequestRef.current
    await fetchData(tickers, timeRange, customStart, customEnd)
  }, [fetchData])

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

  /**
   * Refetch current data (force refresh)
   */
  const refetch = useCallback(async (): Promise<void> => {
    if (!lastRequestRef.current) {
      return
    }

    // Clear cache for this request
    if (lastRequestRef.current) {
      const { tickers, timeRange, customStart, customEnd } = lastRequestRef.current
      const startDate = calculateStartDate(timeRange, customStart)
      const endDate = calculateEndDate(timeRange, customEnd)
      
      const options: StockDataOptions = {
        tickers,
        start_date: startDate,
        end_date: endDate,
        force_refresh: true,
        include_dividends: false,
        max_workers: 5
      }
      
      const cacheKey = getCacheKey(options)
      cacheRef.current.delete(cacheKey)
    }

    await retry()
  }, [retry, getCacheKey])

  return {
    data,
    loading,
    error,
    lastFetched,
    fetchData,
    refetch,
    retry,
    clearError,
    cancel
  }
}