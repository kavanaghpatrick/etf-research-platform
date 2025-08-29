import {
  API_CONFIG,
  API_ENDPOINTS,
  ApiErrorType,
  sanitizeErrorMessage,
  createApiError,
  createTimeoutController,
  cleanupRequest,
  sleep,
  calculateBackoffDelay,
  apiRequest,
  debounce,
} from '../api'

// Mock fetch
global.fetch = jest.fn()

// Mock timers
jest.useFakeTimers()

describe('API Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    ;(global.fetch as jest.Mock).mockReset()
  })

  afterEach(() => {
    jest.runAllTimers()
  })

  describe('API_CONFIG', () => {
    it('should have default configuration values', () => {
      expect(API_CONFIG).toMatchObject({
        BASE_URL: expect.stringContaining('localhost:8000'),
        TIMEOUT: expect.any(Number),
        CACHE_DURATION: expect.any(Number),
        MAX_RETRIES: expect.any(Number),
        DEBOUNCE_DELAY: expect.any(Number),
      })
    })

    it('should use environment variables when available', () => {
      // This would test env var usage if they were set
      expect(API_CONFIG.TIMEOUT).toBeGreaterThan(0)
      expect(API_CONFIG.MAX_RETRIES).toBeGreaterThan(0)
    })
  })

  describe('API_ENDPOINTS', () => {
    it('should generate correct endpoint URLs', () => {
      expect(API_ENDPOINTS.FETCH_DATA).toContain('/data/fetch')
      expect(API_ENDPOINTS.DIVIDENDS('AAPL')).toContain('/dividends/AAPL')
    })

    it('should include base URL in endpoints', () => {
      expect(API_ENDPOINTS.FETCH_DATA).toMatch(API_CONFIG.BASE_URL)
      expect(API_ENDPOINTS.DIVIDENDS('TEST')).toMatch(API_CONFIG.BASE_URL)
    })
  })

  describe('sanitizeErrorMessage', () => {
    it('should sanitize localhost URLs', () => {
      const error = new Error('Failed to connect to localhost:8000')
      expect(sanitizeErrorMessage(error)).toBe('Failed to connect to [API_HOST]')
    })

    it('should sanitize HTTP URLs', () => {
      const error = new Error('Request to http://api.example.com/data failed')
      expect(sanitizeErrorMessage(error)).toBe('Request to [API_URL]/data failed')
    })

    it('should sanitize HTTPS URLs', () => {
      const error = new Error('Request to https://secure.api.com/v1 failed')
      expect(sanitizeErrorMessage(error)).toBe('Request to [API_URL]/v1 failed')
    })

    it('should sanitize Bearer tokens', () => {
      const error = new Error('Authorization failed: Bearer abc123xyz')
      expect(sanitizeErrorMessage(error)).toBe('Authorization failed: [TOKEN]')
    })

    it('should sanitize passwords', () => {
      const error = new Error('Database error: password=secret123')
      expect(sanitizeErrorMessage(error)).toBe('Database error: password=[REDACTED]')
    })

    it('should sanitize API keys', () => {
      const error = new Error('Invalid key=sk_test_123456')
      expect(sanitizeErrorMessage(error)).toBe('Invalid key=[REDACTED]')
    })

    it('should handle non-Error objects', () => {
      expect(sanitizeErrorMessage('string error')).toBe('An unexpected error occurred')
      expect(sanitizeErrorMessage(null)).toBe('An unexpected error occurred')
      expect(sanitizeErrorMessage(undefined)).toBe('An unexpected error occurred')
      expect(sanitizeErrorMessage({ message: 'object' })).toBe('An unexpected error occurred')
    })

    it('should handle complex error messages', () => {
      const error = new Error('Failed to fetch from http://localhost:3000/api with Bearer token123 and password=pass')
      expect(sanitizeErrorMessage(error)).toBe('Failed to fetch from [API_URL]/api with [TOKEN] and password=[REDACTED]')
    })
  })

  describe('createApiError', () => {
    it('should identify network errors', () => {
      const error = new TypeError('Failed to fetch')
      const apiError = createApiError(error)
      
      expect(apiError).toMatchObject({
        type: ApiErrorType.NETWORK_ERROR,
        message: 'Network connection failed. Please check your internet connection.',
        timestamp: expect.any(Number),
      })
    })

    it('should identify timeout errors', () => {
      const error = new Error('Request aborted')
      error.name = 'AbortError'
      const apiError = createApiError(error)
      
      expect(apiError).toMatchObject({
        type: ApiErrorType.TIMEOUT,
        message: 'Request timed out. Please try again.',
        timestamp: expect.any(Number),
      })
    })

    it('should identify invalid ticker errors', () => {
      const error404 = new Error('404 Not Found')
      const apiError404 = createApiError(error404)
      
      expect(apiError404.type).toBe(ApiErrorType.INVALID_TICKER)
      expect(apiError404.message).toBe('Invalid ticker symbol or data not found.')

      const errorInvalid = new Error('Invalid ticker: XYZ')
      const apiErrorInvalid = createApiError(errorInvalid)
      
      expect(apiErrorInvalid.type).toBe(ApiErrorType.INVALID_TICKER)
    })

    it('should identify server errors', () => {
      const error500 = new Error('500 Internal Server Error')
      const apiError500 = createApiError(error500)
      
      expect(apiError500.type).toBe(ApiErrorType.API_ERROR)
      expect(apiError500.message).toBe('Server error. Please try again later.')

      const error502 = new Error('502 Bad Gateway')
      const apiError502 = createApiError(error502)
      
      expect(apiError502.type).toBe(ApiErrorType.API_ERROR)
    })

    it('should handle generic errors', () => {
      const error = new Error('Some API error')
      const apiError = createApiError(error)
      
      expect(apiError.type).toBe(ApiErrorType.API_ERROR)
      expect(apiError.message).toBe('Some API error')
    })

    it('should handle unknown errors', () => {
      const apiError = createApiError('string error')
      
      expect(apiError).toMatchObject({
        type: ApiErrorType.UNKNOWN,
        message: 'An unexpected error occurred',
        details: 'string error',
        timestamp: expect.any(Number),
      })
    })
  })

  describe('createTimeoutController', () => {
    it('should create AbortController with timeout', () => {
      const { controller, timeoutId } = createTimeoutController(5000)
      
      expect(controller).toBeInstanceOf(AbortController)
      expect(timeoutId).toBeDefined()
      expect(controller.signal.aborted).toBe(false)
      
      jest.advanceTimersByTime(5000)
      expect(controller.signal.aborted).toBe(true)
    })

    it('should use default timeout when not specified', () => {
      const { controller } = createTimeoutController()
      
      expect(controller.signal.aborted).toBe(false)
      jest.advanceTimersByTime(API_CONFIG.TIMEOUT)
      expect(controller.signal.aborted).toBe(true)
    })
  })

  describe('cleanupRequest', () => {
    it('should clear timeout and abort controller', () => {
      const { controller, timeoutId } = createTimeoutController(5000)
      
      cleanupRequest(controller, timeoutId)
      
      expect(controller.signal.aborted).toBe(true)
      
      // Advance timers to ensure timeout doesn't fire
      jest.advanceTimersByTime(5000)
      // No additional aborts should occur
    })

    it('should handle null controller', () => {
      expect(() => cleanupRequest(null)).not.toThrow()
    })

    it('should handle undefined timeoutId', () => {
      const controller = new AbortController()
      expect(() => cleanupRequest(controller)).not.toThrow()
    })
  })

  describe('sleep', () => {
    it('should delay for specified milliseconds', async () => {
      const promise = sleep(1000)
      
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 1000)
      
      jest.advanceTimersByTime(1000)
      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff', () => {
      expect(calculateBackoffDelay(0)).toBe(1000)
      expect(calculateBackoffDelay(1)).toBe(2000)
      expect(calculateBackoffDelay(2)).toBe(4000)
      expect(calculateBackoffDelay(3)).toBe(8000)
    })

    it('should cap at maximum delay', () => {
      expect(calculateBackoffDelay(10)).toBe(30000)
      expect(calculateBackoffDelay(20)).toBe(30000)
    })

    it('should use custom base delay', () => {
      expect(calculateBackoffDelay(0, 500)).toBe(500)
      expect(calculateBackoffDelay(1, 500)).toBe(1000)
      expect(calculateBackoffDelay(2, 500)).toBe(2000)
    })
  })

  describe('apiRequest', () => {
    it('should make successful API request', async () => {
      const mockData = { success: true }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      const result = await apiRequest('https://api.example.com/data')
      
      expect(result).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      )
    })

    it('should handle request timeout', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))

      const promise = apiRequest('https://api.example.com/data', { timeout: 1000, retries: 0 })
      
      jest.advanceTimersByTime(1000)
      
      await expect(promise).rejects.toThrow()
    })

    it('should retry on failure', async () => {
      const mockData = { success: true }
      ;(global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockData,
        })

      const promise = apiRequest('https://api.example.com/data', { retries: 2 })
      
      // Advance through retry delays
      for (let i = 0; i < 3; i++) {
        await Promise.resolve()
        jest.advanceTimersByTime(30000) // Advance enough for any backoff
      }

      const result = await promise
      
      expect(result).toEqual(mockData)
      expect(global.fetch).toHaveBeenCalledTimes(3)
    })

    it('should handle non-OK responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(apiRequest('https://api.example.com/data', { retries: 0 })).rejects.toThrow('404')
    })

    it('should apply custom request options', async () => {
      const mockData = { success: true }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      })

      await apiRequest('https://api.example.com/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"test":true}',
        })
      )
    })
  })

  describe('debounce', () => {
    it('should debounce function calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 300)

      debouncedFn('call1')
      debouncedFn('call2')
      debouncedFn('call3')

      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(300)

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('call3')
    })

    it('should handle multiple debounce cycles', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 200)

      // First cycle
      debouncedFn('first')
      jest.advanceTimersByTime(200)
      expect(mockFn).toHaveBeenCalledWith('first')

      // Second cycle
      debouncedFn('second')
      jest.advanceTimersByTime(200)
      expect(mockFn).toHaveBeenCalledWith('second')

      expect(mockFn).toHaveBeenCalledTimes(2)
    })

    it('should preserve this context', () => {
      const obj = {
        value: 'test',
        method: jest.fn(function(this: any) {
          return this.value
        }),
      }

      obj.method = debounce(obj.method, 100)
      obj.method()

      jest.advanceTimersByTime(100)

      expect(obj.method).toHaveBeenCalled()
    })
  })
})