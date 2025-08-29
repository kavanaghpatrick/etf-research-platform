/**
 * Centralized API configuration and utilities
 * Provides secure, configurable API endpoints and request handling
 */

// API Configuration from environment variables
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:8000',
  TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || process.env.API_TIMEOUT || '10000'),
  CACHE_DURATION: parseInt(process.env.NEXT_PUBLIC_API_CACHE_DURATION || process.env.API_CACHE_DURATION || '300000'),
  MAX_RETRIES: parseInt(process.env.NEXT_PUBLIC_API_MAX_RETRIES || process.env.API_MAX_RETRIES || '3'),
  DEBOUNCE_DELAY: parseInt(process.env.NEXT_PUBLIC_API_DEBOUNCE_DELAY || process.env.API_DEBOUNCE_DELAY || '300'),
} as const

/**
 * API Endpoints
 */
export const API_ENDPOINTS = {
  FETCH_DATA: `${API_CONFIG.BASE_URL}/data/fetch`,
  DIVIDENDS: (ticker: string) => `${API_CONFIG.BASE_URL}/dividends/${ticker}`,
} as const

/**
 * Error types for better error handling
 */
export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_TICKER = 'INVALID_TICKER',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured API error information
 */
export interface ApiErrorInfo {
  type: ApiErrorType
  message: string
  details?: unknown
  timestamp: number
}

/**
 * Request options for API calls
 */
export interface ApiRequestOptions extends RequestInit {
  timeout?: number
  retries?: number
}

/**
 * Sanitize error messages to prevent sensitive data exposure
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove sensitive information from error messages
    const sanitizedMessage = error.message
      .replace(/localhost:\d+/g, '[API_HOST]')
      .replace(/http:\/\/[^\/\s]+/g, '[API_URL]')
      .replace(/https:\/\/[^\/\s]+/g, '[API_URL]')
      .replace(/Bearer\s+[A-Za-z0-9\-_]+/g, '[TOKEN]')
      .replace(/password=\w+/gi, 'password=[REDACTED]')
      .replace(/key=\w+/gi, 'key=[REDACTED]')
    
    return sanitizedMessage
  }
  
  return 'An unexpected error occurred'
}

/**
 * Create structured error information from raw errors
 */
export function createApiError(error: unknown): ApiErrorInfo {
  const timestamp = Date.now()
  
  if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
    return {
      type: ApiErrorType.NETWORK_ERROR,
      message: 'Network connection failed. Please check your internet connection.',
      details: sanitizeErrorMessage(error),
      timestamp,
    }
  }
  
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return {
        type: ApiErrorType.TIMEOUT,
        message: 'Request timed out. Please try again.',
        details: sanitizeErrorMessage(error),
        timestamp,
      }
    }
    
    if (error.message.includes('404') || error.message.includes('Invalid ticker')) {
      return {
        type: ApiErrorType.INVALID_TICKER,
        message: 'Invalid ticker symbol or data not found.',
        details: sanitizeErrorMessage(error),
        timestamp,
      }
    }
    
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      return {
        type: ApiErrorType.API_ERROR,
        message: 'Server error. Please try again later.',
        details: sanitizeErrorMessage(error),
        timestamp,
      }
    }
    
    return {
      type: ApiErrorType.API_ERROR,
      message: sanitizeErrorMessage(error),
      details: error,
      timestamp,
    }
  }
  
  return {
    type: ApiErrorType.UNKNOWN,
    message: 'An unexpected error occurred',
    details: error,
    timestamp,
  }
}

/**
 * Create AbortController with timeout
 */
export function createTimeoutController(timeoutMs: number = API_CONFIG.TIMEOUT): {
  controller: AbortController
  timeoutId: NodeJS.Timeout
} {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)
  
  return { controller, timeoutId }
}

/**
 * Cleanup timeout and AbortController
 */
export function cleanupRequest(controller: AbortController | null, timeoutId?: NodeJS.Timeout) {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
  if (controller && !controller.signal.aborted) {
    controller.abort()
  }
}

/**
 * Sleep utility for retry logic
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
}

/**
 * Enhanced fetch with timeout, retries, and error handling
 */
export async function apiRequest<T = unknown>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    timeout = API_CONFIG.TIMEOUT,
    retries = API_CONFIG.MAX_RETRIES,
    ...fetchOptions
  } = options
  
  console.log('[apiRequest] Making request to:', url, {
    method: fetchOptions.method || 'GET',
    timeout,
    retries
  })
  
  let lastError: unknown
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { controller, timeoutId } = createTimeoutController(timeout)
    
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        console.log('[apiRequest] HTTP error:', response.status, response.statusText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[apiRequest] Response received:', {
        url,
        status: response.status,
        dataKeys: Object.keys(data || {}),
        hasData: !!data
      })
      return data as T
      
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error
      
      // Don't retry on certain error types
      if (error instanceof Error) {
        if (error.name === 'AbortError' && attempt < retries) {
          // Only retry timeouts
          const delay = calculateBackoffDelay(attempt)
          await sleep(delay)
          continue
        }
        
        if (error.message.includes('404') || error.message.includes('400')) {
          // Don't retry client errors
          break
        }
      }
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        break
      }
      
      // Wait before retrying
      const delay = calculateBackoffDelay(attempt)
      await sleep(delay)
    }
  }
  
  throw createApiError(lastError)
}

/**
 * Debounce utility for API calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number = API_CONFIG.DEBOUNCE_DELAY
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

/**
 * Validate ticker symbols
 */
export function validateTickerSymbols(tickers: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  
  tickers.forEach(ticker => {
    const trimmed = ticker.trim().toUpperCase()
    if (trimmed.length > 0 && trimmed.length <= 10 && /^[A-Z]+$/.test(trimmed)) {
      valid.push(trimmed)
    } else {
      invalid.push(ticker)
    }
  })
  
  return { valid, invalid }
}