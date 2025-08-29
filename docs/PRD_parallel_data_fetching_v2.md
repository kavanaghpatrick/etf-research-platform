# PRD: Parallel Data Fetching Implementation - Vercel Optimized (v2)

## 1. Executive Summary

### Overview of Parallel Fetching Strategy for Vercel
The current implementation uses a sequential fallback pattern for data sources, resulting in significant delays when primary sources fail. This PRD proposes implementing a parallel data fetching architecture optimized for Vercel's serverless environment, leveraging Edge Functions, Vercel KV (powered by Upstash Redis), and regional deployment strategies to dramatically reduce response times while maintaining data quality and rate limit compliance.

### Expected API Response Time Improvements
- **Current State**: 10-20 seconds per ticker (sequential source fallback)
- **Target State**: 1-3 seconds per ticker (parallel execution with Edge optimization)
- **Expected Improvement**: 85-90% reduction in response time
- **Batch Processing**: 50 tickers in ~10 seconds vs current ~300 seconds
- **Edge Caching**: Sub-100ms responses for frequently accessed data

### Cost-Benefit Analysis
**Benefits:**
- Improved user experience with Edge-optimized data retrieval
- Better API utilization with regional awareness
- Increased reliability through Vercel's global infrastructure
- Real-time source health monitoring at Edge
- Optimized costs with Vercel's pay-per-request model

**Costs:**
- Vercel KV usage (pay-per-request with Upstash)
- Edge Function invocations
- Data Cache storage
- Initial development effort (~30 hours)
- Monitoring with Vercel Analytics

## 2. Problem Statement

### Current Issues
1. **Sequential Source Fallback in Serverless Context**
   - Cold starts compound sequential delays
   - Each function invocation adds overhead
   - No persistent connection pooling

2. **Serverless Function Isolation**
   - No shared memory between invocations
   - Cannot maintain local state
   - Rate limiting must be distributed

3. **Regional Latency Variations**
   - Data sources have different regional performance
   - No intelligent regional routing
   - Suboptimal for global users

### Vercel-Specific Challenges
- **Cold Start Penalties**: Each function instance starts fresh
- **Execution Time Limits**: 10s for Hobby, 60s for Pro
- **Memory Constraints**: Max 3008MB per function
- **No Background Processing**: All work must complete in request

## 3. Goals & Success Metrics

### Primary Goals
1. **Reduce Data Fetch Time by 85%**
   - Target: 1-3 seconds per ticker
   - Sub-100ms for cached data at Edge
   - Batch operations under 10 seconds for 50 tickers

2. **Leverage Vercel Infrastructure**
   - Utilize Vercel KV for distributed state
   - Implement Edge Middleware for early filtering
   - Deploy to optimal regions

3. **Optimize for Serverless Costs**
   - Minimize function execution time
   - Reduce KV operations
   - Maximize Edge cache hits

### Success Metrics
- **Performance**: P95 response time < 3 seconds
- **Edge Performance**: P95 Edge cache hit < 100ms
- **Reliability**: 99.9% uptime using Vercel SLA
- **Cost Efficiency**: < $0.001 per request average
- **Cold Start Impact**: < 500ms additional latency

## 4. Technical Requirements

### Vercel KV Rate Limiting Implementation
```typescript
// Edge Middleware for rate limiting
import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `rate_limit:${ip}:${Math.floor(Date.now() / 60000)}`;
  
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, 60);
    }
    
    if (count > 100) { // 100 requests per minute
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }
  } catch (error) {
    // Fail open - don't block on KV errors
    console.error('Rate limit check failed:', error);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

### Distributed Coordination with Vercel KV
```typescript
// Global state management for serverless
class VercelKVCoordinator {
  async acquireLock(resource: string, ttl: number = 5000): Promise<boolean> {
    const lockKey = `lock:${resource}`;
    const lockValue = crypto.randomUUID();
    
    // Set lock with NX (only if not exists) and PX (with expiry)
    const acquired = await kv.set(lockKey, lockValue, {
      nx: true,
      px: ttl
    });
    
    return acquired === 'OK';
  }
  
  async updateSourceHealth(source: string, success: boolean) {
    const healthKey = `health:${source}`;
    const timestamp = Date.now();
    
    // Use Redis sorted sets for time-series data
    await kv.zadd(healthKey, {
      score: timestamp,
      member: `${timestamp}:${success ? 1 : 0}`
    });
    
    // Keep only last hour of data
    await kv.zremrangebyscore(healthKey, 0, timestamp - 3600000);
  }
  
  async getSourceHealth(source: string): Promise<number> {
    const healthKey = `health:${source}`;
    const hourAgo = Date.now() - 3600000;
    
    const results = await kv.zrangebyscore(healthKey, hourAgo, '+inf');
    if (!results || results.length === 0) return 1.0;
    
    const successCount = results.filter(r => 
      r.split(':')[1] === '1'
    ).length;
    
    return successCount / results.length;
  }
}
```

### Regional Deployment Strategy
```typescript
// vercel.json configuration for multi-region deployment
{
  "functions": {
    "api/data/[ticker].ts": {
      "maxDuration": 60,
      "regions": ["iad1", "sfo1", "lhr1", "syd1", "sin1"]
    }
  },
  "rewrites": [
    {
      "source": "/api/data/:ticker",
      "destination": "/api/data/[ticker]"
    }
  ]
}

// Regional source selection
class RegionalSourceSelector {
  private regionalLatencies = {
    'iad1': { // US East
      'alphavantage': 20,
      'tiingo': 15,
      'yfinance': 25,
      'polygon': 10
    },
    'sfo1': { // US West
      'alphavantage': 25,
      'tiingo': 20,
      'yfinance': 30,
      'polygon': 15
    },
    'lhr1': { // Europe
      'alphavantage': 40,
      'tiingo': 35,
      'yfinance': 20,
      'polygon': 45
    }
  };
  
  selectOptimalSources(region: string): string[] {
    const latencies = this.regionalLatencies[region] || this.regionalLatencies['iad1'];
    
    return Object.entries(latencies)
      .sort(([, a], [, b]) => a - b)
      .map(([source]) => source);
  }
}
```

### Vercel Edge Caching Strategy
```typescript
// API route with stale-while-revalidate caching
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  
  // Check Edge cache first
  const cacheKey = `ticker:${ticker}:${new Date().toISOString().split('T')[0]}`;
  
  // Set cache headers for Edge caching
  const headers = {
    'Cache-Control': 's-maxage=300, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'max-age=300',
    'Vercel-CDN-Cache-Control': 'max-age=300',
  };
  
  try {
    // Try to get from Vercel Data Cache
    const cached = await getFromDataCache(cacheKey);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: { ...headers, 'X-Cache': 'HIT' }
      });
    }
    
    // Parallel fetch with Vercel's optimized fetch
    const data = await parallelFetchWithVercel(ticker);
    
    // Store in Data Cache
    await storeInDataCache(cacheKey, data, 300); // 5 min TTL
    
    return new Response(JSON.stringify(data), {
      headers: { ...headers, 'X-Cache': 'MISS' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers
    });
  }
}

// Vercel-optimized parallel fetching
async function parallelFetchWithVercel(ticker: string) {
  const region = process.env.VERCEL_REGION || 'iad1';
  const sources = new RegionalSourceSelector().selectOptimalSources(region);
  
  // Use Vercel's fetch with automatic retries and connection pooling
  const fetches = sources.map(source => 
    fetch(`${getSourceUrl(source)}/quote/${ticker}`, {
      signal: AbortSignal.timeout(3000), // 3s timeout
      // Vercel automatically handles retries and connection pooling
    }).then(async res => {
      if (!res.ok) throw new Error(`${source} failed`);
      return { source, data: await res.json() };
    }).catch(err => {
      console.error(`${source} error:`, err);
      return null;
    })
  );
  
  // Race for first successful response
  const results = await Promise.race([
    Promise.any(fetches.filter(Boolean)),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('All sources timed out')), 5000)
    )
  ]);
  
  return results;
}
```

### Vercel Function Configuration
```typescript
// api/data/batch.ts - Batch processing endpoint
export const config = {
  maxDuration: 60, // Pro plan limit
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

export async function POST(request: Request) {
  const { tickers } = await request.json();
  
  // Limit batch size for function execution time
  if (tickers.length > 50) {
    return new Response('Batch size limited to 50 tickers', { status: 400 });
  }
  
  // Check rate limits in KV
  const rateLimiter = new VercelKVRateLimiter();
  const canProceed = await rateLimiter.checkBatchLimit(tickers.length);
  
  if (!canProceed) {
    return new Response('Rate limit exceeded', { status: 429 });
  }
  
  // Process in parallel with concurrency limit
  const results = await pLimit(10)( // Max 10 concurrent
    tickers.map(ticker => async () => {
      try {
        return await parallelFetchWithVercel(ticker);
      } catch (error) {
        return { ticker, error: error.message };
      }
    })
  );
  
  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=60',
    }
  });
}
```

## 5. Implementation Plan

### Phase 1: Vercel KV Setup (Week 1)
- Set up Vercel KV (Upstash Redis)
- Implement distributed rate limiting
- Create KV-based health tracking
- Deploy Edge middleware
- Test distributed coordination

### Phase 2: Edge Function Optimization (Week 2)
- Implement parallel fetching functions
- Add regional source selection
- Configure multi-region deployment
- Optimize for cold starts
- Add connection pooling

### Phase 3: Caching Layer (Week 3)
- Implement Vercel Data Cache
- Configure Edge caching rules
- Add stale-while-revalidate
- Set up cache warming
- Monitor cache performance

### Phase 4: Monitoring & Analytics (Week 4)
- Integrate Vercel Analytics
- Set up custom metrics in KV
- Create performance dashboards
- Configure alerts
- Load testing on Vercel

## 6. Architecture Design

### Vercel-Optimized Architecture
```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Client    │────▶│ Edge Middleware │────▶│  Vercel KV   │
└─────────────┘     └────────┬────────┘     └──────┬───────┘
                             │                      │
                    ┌────────▼────────┐            │
                    │ Edge Functions  │◀───────────┘
                    │  (Multi-Region) │
                    └────────┬────────┘
                             │
                    ┌────────┴─────────────┬─────────────┐
                    ▼                      ▼             ▼
              ┌─────────┐           ┌─────────┐   ┌─────────┐
              │Regional │           │Regional │   │Regional │
              │Sources  │           │Sources  │   │Sources  │
              └─────────┘           └─────────┘   └─────────┘
                    │                      │             │
                    └──────────────────────┴─────────────┘
                                          │
                                ┌─────────▼─────────┐
                                │  Vercel Cache     │
                                │  (Edge + Data)    │
                                └───────────────────┘
```

### Rate Limiting with Vercel KV
- **Global Limits**: Enforced at Edge Middleware
- **Per-Source Limits**: Managed in KV with atomic operations
- **User Limits**: IP-based tracking in Edge
- **Cost Optimization**: Minimize KV operations

### Error Handling in Serverless
1. **Function Timeout**: Return partial results
2. **KV Connection Error**: Fail open, log for monitoring
3. **Source Failures**: Circuit breaker in KV
4. **Cold Start Delays**: Pre-warm critical paths
5. **Memory Limits**: Stream large responses

## 7. Cost Optimization

### Vercel Pricing Considerations
```typescript
// Cost calculation helper
class VercelCostOptimizer {
  // Vercel KV (Upstash) pricing
  private kvCosts = {
    commands: 0.2 / 100000,  // $0.2 per 100k commands
    storage: 0.25,           // $0.25 per GB
  };
  
  // Function invocation costs
  private functionCosts = {
    invocations: 0.60 / 1000000,     // $0.60 per 1M
    gbHours: 0.00005,                // $0.00005 per GB-hour
  };
  
  estimateMonthlyCost(
    dailyRequests: number,
    avgExecutionTime: number,
    avgMemoryMB: number
  ): number {
    const monthlyRequests = dailyRequests * 30;
    
    // KV costs (2 commands per request avg)
    const kvCommandCost = monthlyRequests * 2 * this.kvCosts.commands;
    
    // Function costs
    const invocationCost = monthlyRequests * this.functionCosts.invocations;
    const gbHours = (monthlyRequests * avgExecutionTime * avgMemoryMB) / (1000 * 3600 * 1024);
    const computeCost = gbHours * this.functionCosts.gbHours;
    
    return kvCommandCost + invocationCost + computeCost;
  }
}

// Optimize KV usage
class OptimizedKVOperations {
  async batchGetRateLimits(keys: string[]): Promise<Map<string, number>> {
    // Use MGET for batch operations
    const values = await kv.mget(...keys);
    return new Map(keys.map((key, i) => [key, values[i] || 0]));
  }
  
  async updateMetricsEfficiently(metrics: Record<string, any>) {
    // Use pipeline for multiple operations
    const pipeline = kv.pipeline();
    
    Object.entries(metrics).forEach(([key, value]) => {
      pipeline.hincrby(`metrics:${new Date().toISOString().split('T')[0]}`, key, value);
    });
    
    pipeline.expire(`metrics:${new Date().toISOString().split('T')[0]}`, 86400 * 7);
    
    await pipeline.exec();
  }
}
```

## 8. Monitoring & Observability

### Vercel Analytics Integration
```typescript
// Custom metrics tracking
import { track } from '@vercel/analytics';

export async function trackDataFetch(
  ticker: string,
  source: string,
  latency: number,
  success: boolean
) {
  await track('data_fetch', {
    ticker,
    source,
    latency,
    success,
    region: process.env.VERCEL_REGION,
    environment: process.env.VERCEL_ENV,
  });
}

// Performance monitoring
export function withPerformanceTracking<T>(
  fn: (...args: any[]) => Promise<T>,
  eventName: string
) {
  return async (...args: any[]): Promise<T> => {
    const start = Date.now();
    let success = true;
    
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = Date.now() - start;
      await track(eventName, {
        duration,
        success,
        region: process.env.VERCEL_REGION,
      });
    }
  };
}
```

### Alerting with Vercel
```typescript
// Webhook alerts for critical issues
export async function sendAlert(
  level: 'critical' | 'warning',
  message: string,
  metadata?: any
) {
  if (level === 'critical') {
    await fetch(process.env.ALERT_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${message}`,
        blocks: [{
          type: 'section',
          text: { type: 'mrkdwn', text: message },
          fields: Object.entries(metadata || {}).map(([key, value]) => ({
            type: 'mrkdwn',
            text: `*${key}:* ${value}`
          }))
        }]
      })
    });
  }
}
```

## 9. Testing Strategy

### Vercel-Specific Testing
1. **Cold Start Testing**
   ```bash
   # Test cold start performance
   for i in {1..10}; do
     curl -w "@curl-format.txt" -o /dev/null -s https://your-app.vercel.app/api/data/AAPL
     sleep 300 # Wait for function to go cold
   done
   ```

2. **Regional Performance Testing**
   - Deploy to multiple regions
   - Test from different geographic locations
   - Measure regional latency differences

3. **KV Reliability Testing**
   - Simulate KV connection failures
   - Test fallback mechanisms
   - Verify data consistency

### Load Testing on Vercel
```typescript
// Load test configuration
export const loadTestConfig = {
  scenarios: {
    // Gradual load increase
    rampUp: {
      startRate: 10,
      endRate: 1000,
      duration: '5m',
    },
    // Sustained load
    sustained: {
      rate: 500,
      duration: '10m',
    },
    // Spike test
    spike: {
      rate: 2000,
      duration: '1m',
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% under 3s
    http_req_failed: ['rate<0.01'],    // Error rate under 1%
  }
};
```

## 10. Migration Strategy

### Gradual Rollout Plan
1. **Week 1**: Deploy to Vercel with feature flag
2. **Week 2**: Enable for 10% of traffic
3. **Week 3**: Increase to 50% with monitoring
4. **Week 4**: Full rollout if metrics are good

### Rollback Strategy
- Feature flags for instant rollback
- Maintain sequential fallback as backup
- Monitor error rates and latency
- Automated rollback on threshold breach

### Success Criteria
- 85% reduction in P95 latency
- Zero increase in error rates
- Positive user feedback
- Cost within 20% of projections
- Successful handling of peak loads