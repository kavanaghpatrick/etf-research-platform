import { rest } from 'msw'
import { setupServer } from 'msw/node'

// API test utilities for mocking and testing API interactions

// Base API URL from environment or default
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// MSW server instance
export const server = setupServer()

// Setup and teardown for tests
export function setupAPITests() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
}

// API endpoint builders
export const apiEndpoints = {
  stock: (symbol: string) => `${API_BASE_URL}/api/stock/${symbol}`,
  dividends: (symbol: string) => `${API_BASE_URL}/api/stock/${symbol}/dividends`,
  chart: (symbol: string, range: string) => `${API_BASE_URL}/api/stock/${symbol}/chart/${range}`,
  search: (query: string) => `${API_BASE_URL}/api/search?q=${query}`,
  watchlist: () => `${API_BASE_URL}/api/watchlist`,
}

// Mock response builders
export const mockResponses = {
  stock: (overrides = {}) => ({
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150.25,
    previousClose: 147.75,
    change: 2.50,
    changePercent: 1.69,
    volume: 50000000,
    avgVolume: 45000000,
    marketCap: 2500000000000,
    pe: 28.5,
    eps: 5.27,
    high: 151.50,
    low: 148.00,
    open: 148.50,
    week52High: 182.94,
    week52Low: 124.17,
    ...overrides,
  }),

  dividends: (count = 4) => ({
    dividends: Array.from({ length: count }, (_, i) => ({
      exDate: new Date(Date.now() - i * 90 * 24 * 60 * 60 * 1000).toISOString(),
      paymentDate: new Date(Date.now() - (i * 90 - 7) * 24 * 60 * 60 * 1000).toISOString(),
      amount: 0.24,
      yield: 0.5,
    })),
  }),

  chartData: (points = 100) => ({
    data: Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(Date.now() - (points - i) * 24 * 60 * 60 * 1000).toISOString(),
      price: 150 + Math.random() * 10 - 5,
      volume: 50000000 + Math.random() * 10000000,
    })),
  }),

  error: (message = 'Internal Server Error', code = 500) => ({
    error: message,
    code,
    timestamp: new Date().toISOString(),
  }),
}

// Handler creators
export const createHandlers = {
  stock: (symbol: string, response: any, options: { delay?: number; status?: number } = {}) =>
    rest.get(apiEndpoints.stock(symbol), (req, res, ctx) => {
      const { delay = 0, status = 200 } = options
      return res(ctx.delay(delay), ctx.status(status), ctx.json(response))
    }),

  dividends: (symbol: string, response: any, options: { delay?: number; status?: number } = {}) =>
    rest.get(apiEndpoints.dividends(symbol), (req, res, ctx) => {
      const { delay = 0, status = 200 } = options
      return res(ctx.delay(delay), ctx.status(status), ctx.json(response))
    }),

  chart: (symbol: string, range: string, response: any, options: { delay?: number; status?: number } = {}) =>
    rest.get(apiEndpoints.chart(symbol, range), (req, res, ctx) => {
      const { delay = 0, status = 200 } = options
      return res(ctx.delay(delay), ctx.status(status), ctx.json(response))
    }),
}

// Scenario builders for common test cases
export const apiScenarios = {
  success: (handlers: any[]) => {
    server.use(...handlers)
  },

  loading: (endpoint: string, delay = 2000) => {
    server.use(
      rest.get(endpoint, (req, res, ctx) => {
        return res(ctx.delay(delay), ctx.json({}))
      })
    )
  },

  error: (endpoint: string, status = 500, message = 'Server Error') => {
    server.use(
      rest.get(endpoint, (req, res, ctx) => {
        return res(
          ctx.status(status),
          ctx.json({ error: message, status })
        )
      })
    )
  },

  timeout: (endpoint: string) => {
    server.use(
      rest.get(endpoint, (req, res) => {
        return res.networkError('Request timeout')
      })
    )
  },

  rateLimit: (endpoint: string) => {
    server.use(
      rest.get(endpoint, (req, res, ctx) => {
        return res(
          ctx.status(429),
          ctx.json({ error: 'Rate limit exceeded', retryAfter: 60 })
        )
      })
    )
  },
}

// Request interceptor for testing
export class RequestInterceptor {
  private requests: Array<{ url: string; method: string; body?: any; headers: Headers }> = []

  constructor() {
    this.setupInterceptor()
  }

  private setupInterceptor() {
    server.events.on('request:start', (req) => {
      this.requests.push({
        url: req.url.toString(),
        method: req.method,
        body: req.body,
        headers: req.headers,
      })
    })
  }

  getRequests() {
    return this.requests
  }

  getLastRequest() {
    return this.requests[this.requests.length - 1]
  }

  findRequest(predicate: (req: any) => boolean) {
    return this.requests.find(predicate)
  }

  clear() {
    this.requests = []
  }

  expectRequest(url: string, method = 'GET') {
    const request = this.findRequest(
      (req) => req.url === url && req.method === method
    )
    expect(request).toBeDefined()
    return request
  }

  expectNoRequest(url: string) {
    const request = this.findRequest((req) => req.url === url)
    expect(request).toBeUndefined()
  }
}

// Performance testing for API calls
export async function measureAPIPerformance(
  apiCall: () => Promise<any>,
  options: {
    maxDuration?: number
    iterations?: number
  } = {}
) {
  const { maxDuration = 1000, iterations = 1 } = options
  const durations: number[] = []

  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await apiCall()
    const duration = performance.now() - start
    durations.push(duration)
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
  const maxMeasured = Math.max(...durations)
  const minMeasured = Math.min(...durations)

  expect(avgDuration).toBeLessThan(maxDuration)

  return {
    average: avgDuration,
    max: maxMeasured,
    min: minMeasured,
    all: durations,
  }
}

// Retry testing helper
export async function testRetryBehavior(
  apiCall: () => Promise<any>,
  options: {
    maxRetries?: number
    retryDelay?: number
    shouldSucceedAfter?: number
  } = {}
) {
  const { maxRetries = 3, retryDelay = 1000, shouldSucceedAfter = 2 } = options
  let attempts = 0

  server.use(
    rest.get('*', (req, res, ctx) => {
      attempts++
      if (attempts <= shouldSucceedAfter) {
        return res(ctx.status(500), ctx.json({ error: 'Server Error' }))
      }
      return res(ctx.json({ success: true }))
    })
  )

  const result = await apiCall()
  
  expect(attempts).toBe(shouldSucceedAfter + 1)
  expect(result).toEqual({ success: true })
}