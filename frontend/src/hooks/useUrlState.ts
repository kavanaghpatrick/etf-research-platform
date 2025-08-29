'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TimeRange } from '@/types/stock'
import { getDefaultTimeRange, isValidTimeRange } from '@/utils/timeRange'

interface UrlStateOptions {
  timeRange: TimeRange
  symbol?: string
  customStart?: string
  customEnd?: string
}

/**
 * Custom hook for managing stock detail page URL state
 * Syncs time range and other parameters with URL search params
 */
export function useUrlState(initialSymbol?: string) {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [urlState, setUrlState] = useState<UrlStateOptions>(() => {
    // Initialize from URL params or defaults
    const timeRangeParam = searchParams.get('range')
    const symbolParam = searchParams.get('symbol') || initialSymbol
    const customStartParam = searchParams.get('start')
    const customEndParam = searchParams.get('end')
    
    return {
      timeRange: isValidTimeRange(timeRangeParam || '') ? timeRangeParam as TimeRange : getDefaultTimeRange(),
      symbol: symbolParam || undefined,
      customStart: customStartParam || undefined,
      customEnd: customEndParam || undefined
    }
  })

  /**
   * Update URL with new state parameters
   */
  const updateUrl = useCallback((newState: Partial<UrlStateOptions>, replace = false) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()))
    
    // Update time range
    if (newState.timeRange !== undefined) {
      if (newState.timeRange === getDefaultTimeRange()) {
        current.delete('range')
      } else {
        current.set('range', newState.timeRange)
      }
    }
    
    // Update symbol
    if (newState.symbol !== undefined) {
      if (newState.symbol) {
        current.set('symbol', newState.symbol)
      } else {
        current.delete('symbol')
      }
    }
    
    // Update custom dates
    if (newState.timeRange === 'CUSTOM') {
      if (newState.customStart) {
        current.set('start', newState.customStart)
      }
      if (newState.customEnd) {
        current.set('end', newState.customEnd)
      }
    } else {
      // Clear custom dates if not using custom range
      current.delete('start')
      current.delete('end')
    }
    
    const search = current.toString()
    const query = search ? `?${search}` : ''
    
    if (replace) {
      router.replace(`${window.location.pathname}${query}`)
    } else {
      router.push(`${window.location.pathname}${query}`)
    }
  }, [router, searchParams])

  /**
   * Update time range in URL and state
   */
  const setTimeRange = useCallback((timeRange: TimeRange, customStart?: string, customEnd?: string) => {
    const newState = {
      ...urlState,
      timeRange,
      customStart: timeRange === 'CUSTOM' ? customStart : undefined,
      customEnd: timeRange === 'CUSTOM' ? customEnd : undefined
    }
    
    setUrlState(newState)
    updateUrl(newState, true)
  }, [urlState, updateUrl])

  /**
   * Update symbol in URL and state
   */
  const setSymbol = useCallback((symbol: string) => {
    const newState = {
      ...urlState,
      symbol
    }
    
    setUrlState(newState)
    updateUrl(newState)
  }, [urlState, updateUrl])

  /**
   * Clear all URL parameters
   */
  const clearUrlState = useCallback(() => {
    router.replace(window.location.pathname)
    setUrlState({
      timeRange: getDefaultTimeRange()
    })
  }, [router])

  /**
   * Get shareable URL for current state
   */
  const getShareableUrl = useCallback((): string => {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`
  }, [])

  // Listen for URL changes (e.g., browser back/forward)
  useEffect(() => {
    const timeRangeParam = searchParams.get('range')
    const symbolParam = searchParams.get('symbol')
    const customStartParam = searchParams.get('start')
    const customEndParam = searchParams.get('end')
    
    const newState = {
      timeRange: isValidTimeRange(timeRangeParam || '') ? timeRangeParam as TimeRange : getDefaultTimeRange(),
      symbol: symbolParam || undefined,
      customStart: customStartParam || undefined,
      customEnd: customEndParam || undefined
    }
    
    setUrlState(newState)
  }, [searchParams])

  return {
    timeRange: urlState.timeRange,
    symbol: urlState.symbol,
    customStart: urlState.customStart,
    customEnd: urlState.customEnd,
    setTimeRange,
    setSymbol,
    clearUrlState,
    getShareableUrl
  }
}

/**
 * Hook for parsing stock symbol from URL path
 * Expected format: /stock/[symbol] or /symbol/[symbol]
 */
export function useStockSymbolFromPath(): string | null {
  const [symbol, setSymbol] = useState<string | null>(null)
  
  useEffect(() => {
    const path = window.location.pathname
    const segments = path.split('/').filter(segment => segment.length > 0)
    
    // Look for symbol in common URL patterns
    if (segments.length >= 2) {
      if (segments[0] === 'stock' || segments[0] === 'symbol') {
        setSymbol(segments[1].toUpperCase())
      }
    }
  }, [])
  
  return symbol
}