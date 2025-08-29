# PRD: Async Architecture Conversion for Vercel Deployment (v2)

## 1. Executive Summary

This document outlines the conversion of the ETF Research Platform API from a synchronous to an asynchronous architecture, specifically optimized for Vercel's serverless environment. The primary goal is to improve performance, reduce response times, and handle concurrent requests while working within Vercel's constraints and leveraging its capabilities.

### Key Benefits
- **3-5x performance improvement** for multi-ticker requests
- **Optimized for Vercel's 10s timeout** (Hobby/Pro) with streaming capabilities
- **Reduced cold start impact** through warming strategies
- **Better resource utilization** within 512MB memory limit
- **Edge function support** for lightweight operations

### Vercel-Specific Considerations
- **Stateless execution**: No persistent filesystem access
- **External database required**: SQLite replacement needed
- **Connection pooling**: Critical for serverless scale
- **Cold start optimization**: 500ms-2s typical startup time

### Risk Assessment
- **Medium Risk**: Database migration from SQLite required
- **Medium Complexity**: Connection pooling and state management
- **High Impact**: Significant performance improvements with proper optimization

## 2. Problem Statement

### Current Synchronous Blocking Issues
1. **Sequential API Calls**: When fetching data for multiple tickers, each external API call blocks the thread
2. **Database Bottlenecks**: SQLite incompatible with Vercel's stateless environment
3. **Poor Concurrency**: Cannot efficiently handle multiple simultaneous requests
4. **Cold Start Penalties**: Synchronous initialization increases startup time

### Vercel-Specific Constraints
- **10-second timeout** (Hobby/Pro), 60s (Enterprise)
- **512MB memory limit** per function invocation
- **50MB response size limit** without streaming
- **No persistent filesystem**: SQLite and file-based caching unavailable
- **Connection limits**: Serverless scale can exhaust database connections

### Performance Bottlenecks in Serverless
- Sequential processing compounds with cold starts
- Database connection overhead on every invocation
- No ability to maintain long-lived connections
- Rate limiting blocks entire function execution

## 3. Goals & Success Metrics

### Specific Performance Targets
- **Response Time**: <3s for 10-ticker requests (from ~8s)
- **Cold Start**: <1s total startup time
- **Memory Usage**: <400MB peak (80% of limit)
- **Timeout Prevention**: 99.9% completion within 8s
- **Edge Performance**: <100ms for cached responses

### Vercel-Optimized Outcomes
- P95 latency with cold starts: <4 seconds
- Connection pool efficiency: >90% reuse rate
- Edge cache hit rate: >70% for popular tickers
- Streaming response start: <500ms
- Concurrent function capacity: 1000+ (Vercel limit)

### Timeline Expectations
- Phase 1 (Database Migration): 2 days
- Phase 2 (Core Async Conversion): 2 days
- Phase 3 (Vercel Optimizations): 2 days
- Phase 4 (Edge Functions): 1 day
- Phase 5 (Testing & Monitoring): 2 days
- **Total**: 9 days

## 4. Technical Requirements

### Database Migration Strategy
Replace SQLite with Vercel-compatible options:

```python
# Option 1: Vercel Postgres (Recommended)
from sqlalchemy.ext.asyncio import create_async_engine
from vercel_postgres import create_pool

DATABASE_URL = os.environ.get("POSTGRES_URL_POOLING")
engine = create_async_engine(
    DATABASE_URL,
    pool_size=5,  # Conservative for serverless
    max_overflow=0,
    pool_pre_ping=True,  # Verify connections
    pool_recycle=300  # Recycle every 5 minutes
)

# Option 2: Planetscale (MySQL-compatible)
DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_async_engine(
    DATABASE_URL,
    pool_size=3,
    max_overflow=0,
    connect_args={
        "ssl": {"rejectUnauthorized": True},
        "connectionLimit": 3
    }
)

# Option 3: Supabase (PostgreSQL)
from supabase import create_client
supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_ANON_KEY")
)
```

### Vercel Function Optimization

#### Standard Function with Streaming
```python
# api/data/fetch.py
from vercel_ai import stream
import asyncio
from typing import AsyncIterator

async def handler(request: Request) -> Response:
    """Vercel function with response streaming"""
    
    # Parse request
    data = await request.json()
    tickers = data.get("tickers", [])
    
    # Stream results as they complete
    async def generate_results() -> AsyncIterator[str]:
        tasks = [fetch_ticker_data(ticker) for ticker in tickers]
        
        # Process results as they complete
        for coro in asyncio.as_completed(tasks):
            try:
                result = await coro
                yield f"data: {json.dumps(result)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return stream(generate_results())
```

#### Edge Function for Lightweight Operations
```python
# api/health/edge.py
export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request) {
  // Edge functions have 30s timeout and better cold starts
  const cache = await caches.open('health-check')
  const cached = await cache.match(request)
  
  if (cached) {
    return cached
  }
  
  const response = new Response(
    JSON.stringify({ 
      status: 'healthy',
      edge: true,
      region: process.env.VERCEL_REGION 
    }),
    { headers: { 'content-type': 'application/json' } }
  )
  
  // Cache for 60 seconds
  response.headers.set('cache-control', 's-maxage=60')
  await cache.put(request, response.clone())
  
  return response
}
```

### Connection Pool Management
```python
# utils/db_pool.py
import asyncio
from contextlib import asynccontextmanager
from functools import lru_cache

class VercelConnectionPool:
    def __init__(self, url: str, max_connections: int = 5):
        self.url = url
        self.max_connections = max_connections
        self._pool = None
        self._lock = asyncio.Lock()
    
    async def get_pool(self):
        """Lazy initialization with double-check locking"""
        if self._pool is None:
            async with self._lock:
                if self._pool is None:
                    self._pool = await self._create_pool()
        return self._pool
    
    async def _create_pool(self):
        """Create connection pool with Vercel optimizations"""
        return await asyncpg.create_pool(
            self.url,
            min_size=1,  # Minimize idle connections
            max_size=self.max_connections,
            max_inactive_connection_lifetime=300,  # 5 minutes
            command_timeout=8,  # Leave 2s buffer for Vercel timeout
            server_settings={
                'jit': 'off'  # Disable JIT for faster cold starts
            }
        )
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire connection with automatic cleanup"""
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            yield conn

# Singleton instance
db_pool = VercelConnectionPool(os.environ["DATABASE_URL"])
```

### Warming Strategy Implementation
```python
# api/warm.py
async def handler(request: Request) -> Response:
    """Warming endpoint to reduce cold starts"""
    
    # Warm up database connection
    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    
    # Pre-compile regex patterns
    import re
    patterns = [
        re.compile(r"^\w+$"),
        re.compile(r"\d{4}-\d{2}-\d{2}")
    ]
    
    # Initialize heavy libraries
    import pandas as pd
    import numpy as np
    
    return Response(
        json.dumps({"warmed": True}),
        headers={
            "cache-control": "s-maxage=300",  # Cache for 5 minutes
            "x-robots-tag": "noindex"  # Don't index warming endpoint
        }
    )

# Cron job configuration (vercel.json)
{
  "crons": [{
    "path": "/api/warm",
    "schedule": "*/5 * * * *"  // Every 5 minutes
  }]
}
```

## 5. Implementation Plan

### Phase 1: Database Migration (Priority: Critical)
1. **Select Database Provider**
   - Evaluate Vercel Postgres vs Planetscale vs Supabase
   - Consider connection limits, pricing, and latency
2. **Schema Migration**
   - Export SQLite schema and adapt for chosen database
   - Implement async ORM models (SQLAlchemy async)
3. **Data Migration**
   - Create migration scripts for existing data
   - Implement dual-write during transition
4. **Connection Pool Setup**
   - Configure pool sizes for serverless scale
   - Implement connection health checks

### Phase 2: Core Async Conversion (Priority: High)
1. **FastAPI Async Endpoints**
   ```python
   # Before
   @app.post("/data/fetch")
   def fetch_data(request: DataFetchRequest):
       return fetch_ticker_data(request.tickers)
   
   # After - Vercel optimized
   @app.post("/data/fetch")
   async def fetch_data(request: DataFetchRequest):
       # Implement request streaming
       async def stream_results():
           async for result in fetch_ticker_data_stream(request.tickers):
               yield f"data: {json.dumps(result)}\n\n"
       
       return StreamingResponse(
           stream_results(),
           media_type="text/event-stream",
           headers={
               "cache-control": "no-cache",
               "connection": "keep-alive"
           }
       )
   ```

2. **Async Data Fetching**
   ```python
   class VercelAsyncDataFetcher:
       def __init__(self):
           self.session = None
           self.rate_limiter = AsyncRateLimiter(rate=100, per=60)
       
       async def __aenter__(self):
           self.session = httpx.AsyncClient(
               timeout=httpx.Timeout(5.0),  # 5s timeout per request
               limits=httpx.Limits(
                   max_keepalive_connections=5,
                   max_connections=10
               )
           )
           return self
       
       async def fetch_multiple(self, tickers: List[str]):
           """Fetch with timeout protection"""
           tasks = []
           for ticker in tickers:
               task = asyncio.create_task(
                   self.fetch_with_timeout(ticker, timeout=4.0)
               )
               tasks.append(task)
           
           # Process as completed to start streaming early
           results = []
           for coro in asyncio.as_completed(tasks):
               try:
                   result = await coro
                   results.append(result)
                   yield result  # Stream immediately
               except Exception as e:
                   logger.error(f"Failed to fetch ticker: {e}")
           
           return results
   ```

### Phase 3: Vercel-Specific Optimizations (Priority: High)

#### Implement Stale-While-Revalidate Caching
```python
from datetime import datetime, timedelta

class VercelCache:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    async def get_with_swr(
        self,
        key: str,
        fetch_func,
        ttl: int = 300,  # 5 minutes
        stale_ttl: int = 3600  # 1 hour
    ):
        """Stale-while-revalidate pattern"""
        
        # Try to get from cache
        cached = await self.redis.get(key)
        if cached:
            data = json.loads(cached)
            age = datetime.now() - datetime.fromisoformat(data["timestamp"])
            
            # Return fresh data
            if age < timedelta(seconds=ttl):
                return data["value"]
            
            # Return stale data and refresh in background
            if age < timedelta(seconds=stale_ttl):
                asyncio.create_task(self._refresh_cache(key, fetch_func))
                return data["value"]
        
        # Fetch fresh data
        value = await fetch_func()
        await self._set_cache(key, value)
        return value
    
    async def _set_cache(self, key: str, value: Any):
        data = {
            "value": value,
            "timestamp": datetime.now().isoformat()
        }
        await self.redis.setex(key, 3600, json.dumps(data))
```

#### Error Handling for Vercel
```python
class VercelErrorHandler:
    @staticmethod
    async def handle_function_error(func, *args, **kwargs):
        """Handle errors with Vercel-specific considerations"""
        try:
            return await func(*args, **kwargs)
        except asyncio.TimeoutError:
            # Log to Vercel Analytics
            logger.error("Function timeout approaching", extra={
                "function": func.__name__,
                "duration": time.time() - start_time
            })
            raise HTTPException(
                status_code=504,
                detail="Request timeout - try fewer tickers"
            )
        except MemoryError:
            logger.error("Memory limit approaching", extra={
                "memory_used": get_memory_usage()
            })
            raise HTTPException(
                status_code=507,
                detail="Resource limit exceeded"
            )
        except Exception as e:
            # Log to Vercel Analytics
            logger.exception("Unhandled error", extra={
                "error_type": type(e).__name__
            })
            raise
```

### Phase 4: Edge Function Implementation (Priority: Medium)

#### Identify Edge-Compatible Operations
```typescript
// api/cache/[ticker].ts - Edge function for cache lookups
export const config = {
  runtime: 'edge',
  regions: ['iad1'],  // Deploy close to database
}

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')
  
  // Use Vercel KV for edge-compatible caching
  const kv = await import('@vercel/kv')
  const cached = await kv.get(`ticker:${ticker}`)
  
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=300, stale-while-revalidate=3600',
        'x-cache': 'HIT'
      }
    })
  }
  
  // Fallback to serverless function
  return fetch(`${process.env.VERCEL_URL}/api/data/fetch?ticker=${ticker}`)
}
```

### Phase 5: Monitoring and Analytics (Priority: High)

#### Vercel Analytics Integration
```python
# utils/analytics.py
from vercel import track
import time
import psutil
import functools

def track_performance(endpoint: str):
    """Decorator to track function performance"""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            start_time = time.time()
            memory_start = psutil.Process().memory_info().rss / 1024 / 1024
            
            try:
                result = await func(*args, **kwargs)
                
                # Track successful execution
                await track({
                    "event": "function_execution",
                    "properties": {
                        "endpoint": endpoint,
                        "duration_ms": (time.time() - start_time) * 1000,
                        "memory_mb": psutil.Process().memory_info().rss / 1024 / 1024 - memory_start,
                        "status": "success"
                    }
                })
                
                return result
                
            except Exception as e:
                # Track errors
                await track({
                    "event": "function_error",
                    "properties": {
                        "endpoint": endpoint,
                        "error_type": type(e).__name__,
                        "duration_ms": (time.time() - start_time) * 1000
                    }
                })
                raise
        
        return wrapper
    return decorator
```

## 6. Code Examples

### Vercel-Optimized Patterns

#### Memory-Efficient Data Processing
```python
async def process_large_dataset(tickers: List[str]):
    """Process data in chunks to stay within memory limits"""
    CHUNK_SIZE = 10  # Process 10 tickers at a time
    
    async def process_chunk(chunk):
        results = await asyncio.gather(
            *[fetch_ticker_data(ticker) for ticker in chunk],
            return_exceptions=True
        )
        
        # Process and immediately return to free memory
        processed = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Failed to process: {result}")
                continue
            processed.append(transform_data(result))
        
        # Explicitly delete to free memory
        del results
        return processed
    
    # Process in chunks
    all_results = []
    for i in range(0, len(tickers), CHUNK_SIZE):
        chunk = tickers[i:i + CHUNK_SIZE]
        chunk_results = await process_chunk(chunk)
        all_results.extend(chunk_results)
        
        # Force garbage collection between chunks
        import gc
        gc.collect()
    
    return all_results
```

#### Request/Response Streaming
```python
from fastapi.responses import StreamingResponse
import asyncio
import json

@app.post("/data/stream")
async def stream_ticker_data(request: DataFetchRequest):
    """Stream results as they complete"""
    
    async def generate():
        # Send initial response immediately
        yield f"data: {json.dumps({'status': 'processing', 'total': len(request.tickers)})}\n\n"
        
        completed = 0
        tasks = {
            asyncio.create_task(fetch_ticker_with_metadata(ticker)): ticker 
            for ticker in request.tickers
        }
        
        # Process as tasks complete
        while tasks:
            done, pending = await asyncio.wait(
                tasks.keys(), 
                return_when=asyncio.FIRST_COMPLETED
            )
            
            for task in done:
                ticker = tasks.pop(task)
                try:
                    result = await task
                    completed += 1
                    
                    yield f"data: {json.dumps({
                        'type': 'result',
                        'ticker': ticker,
                        'data': result,
                        'progress': completed / len(request.tickers)
                    })}\n\n"
                    
                except Exception as e:
                    yield f"data: {json.dumps({
                        'type': 'error',
                        'ticker': ticker,
                        'error': str(e)
                    })}\n\n"
        
        yield f"data: {json.dumps({'status': 'complete'})}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "cache-control": "no-cache",
            "x-accel-buffering": "no"  # Disable nginx buffering
        }
    )
```

## 7. Cost Optimization Strategies

### Function Execution Optimization
```python
# Minimize billable execution time
async def optimized_handler(request):
    # 1. Return early for cached responses
    cache_key = generate_cache_key(request)
    if cached := await quick_cache_check(cache_key):
        return cached
    
    # 2. Defer heavy imports
    # Bad: Import at module level
    # import pandas as pd
    
    # Good: Import only when needed
    if needs_pandas_processing(request):
        import pandas as pd
    
    # 3. Use streaming to start response early
    return StreamingResponse(process_stream(request))
```

### Edge Caching Strategy
```javascript
// Maximize edge cache hits
export default async function handler(req) {
  // Normalize cache keys
  const url = new URL(req.url)
  const params = new URLSearchParams(url.search)
  
  // Sort parameters for consistent cache keys
  const sortedParams = new URLSearchParams(
    [...params.entries()].sort()
  )
  
  return fetch(`/api/data?${sortedParams}`, {
    headers: {
      // Add cache headers
      'cache-control': 's-maxage=300, stale-while-revalidate=3600'
    }
  })
}
```

## 8. Testing Strategy

### Vercel-Specific Testing

#### Local Vercel Environment Testing
```bash
# Install Vercel CLI
npm i -g vercel

# Test functions locally
vercel dev

# Test with production-like environment
vercel env pull .env.local
```

#### Integration Tests for Serverless
```python
import pytest
from httpx import AsyncClient
import asyncio

@pytest.mark.asyncio
async def test_concurrent_requests_within_limits():
    """Test concurrent requests don't exceed Vercel limits"""
    
    async with AsyncClient(base_url="http://localhost:3000") as client:
        # Simulate 50 concurrent requests
        tasks = []
        for i in range(50):
            task = client.post("/api/data/fetch", json={
                "tickers": ["AAPL", "GOOGL"],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            })
            tasks.append(task)
        
        start_time = time.time()
        responses = await asyncio.gather(*tasks)
        duration = time.time() - start_time
        
        # All requests should complete
        assert all(r.status_code == 200 for r in responses)
        
        # Should handle concurrent load efficiently
        assert duration < 10  # Within Vercel timeout

@pytest.mark.asyncio  
async def test_memory_usage_within_limits():
    """Test memory usage stays within Vercel limits"""
    
    import psutil
    process = psutil.Process()
    
    # Measure baseline memory
    baseline_memory = process.memory_info().rss / 1024 / 1024
    
    # Execute memory-intensive operation
    async with AsyncClient(base_url="http://localhost:3000") as client:
        response = await client.post("/api/data/fetch", json={
            "tickers": ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"] * 10,
            "start_date": "2020-01-01",
            "end_date": "2023-12-31"
        })
    
    # Check memory usage
    peak_memory = process.memory_info().rss / 1024 / 1024
    memory_used = peak_memory - baseline_memory
    
    assert memory_used < 400  # Stay under 400MB (80% of 512MB limit)
```

### Load Testing for Vercel
```python
# load_test.py
import asyncio
import aiohttp
import time

async def load_test_vercel_function(url: str, concurrent: int = 10, duration: int = 60):
    """Load test with Vercel constraints in mind"""
    
    results = {
        "success": 0,
        "timeout": 0,
        "error": 0,
        "response_times": []
    }
    
    async def make_request(session):
        try:
            start = time.time()
            async with session.post(url, json={
                "tickers": ["AAPL", "GOOGL", "MSFT"],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }, timeout=aiohttp.ClientTimeout(total=15)) as response:
                await response.json()
                elapsed = time.time() - start
                
                if response.status == 200:
                    results["success"] += 1
                    results["response_times"].append(elapsed)
                elif response.status == 504:
                    results["timeout"] += 1
                else:
                    results["error"] += 1
                    
        except asyncio.TimeoutError:
            results["timeout"] += 1
        except Exception as e:
            results["error"] += 1
            print(f"Error: {e}")
    
    async with aiohttp.ClientSession() as session:
        end_time = time.time() + duration
        tasks = []
        
        while time.time() < end_time:
            # Maintain concurrent requests
            while len(tasks) < concurrent:
                task = asyncio.create_task(make_request(session))
                tasks.append(task)
            
            # Wait for some to complete
            done, tasks = await asyncio.wait(
                tasks, 
                return_when=asyncio.FIRST_COMPLETED
            )
            
            await asyncio.sleep(0.1)  # Small delay between batches
    
    # Calculate statistics
    if results["response_times"]:
        results["avg_response_time"] = sum(results["response_times"]) / len(results["response_times"])
        results["p95_response_time"] = sorted(results["response_times"])[int(len(results["response_times"]) * 0.95)]
    
    return results
```

## 9. Deployment Strategy

### Vercel Configuration
```json
// vercel.json
{
  "functions": {
    "api/data/fetch.py": {
      "maxDuration": 10,
      "memory": 512
    },
    "api/health/edge.ts": {
      "runtime": "edge",
      "maxDuration": 30
    }
  },
  "env": {
    "DATABASE_URL": "@database-url-production",
    "REDIS_URL": "@redis-url-production",
    "ENABLE_ASYNC_MODE": "true"
  },
  "crons": [
    {
      "path": "/api/warm",
      "schedule": "*/5 * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=0"
        }
      ]
    }
  ]
}
```

### Environment-Specific Configuration
```python
# config/vercel.py
import os

class VercelConfig:
    # Detect Vercel environment
    IS_VERCEL = os.environ.get("VERCEL") == "1"
    IS_PRODUCTION = os.environ.get("VERCEL_ENV") == "production"
    IS_PREVIEW = os.environ.get("VERCEL_ENV") == "preview"
    
    # Vercel-specific settings
    FUNCTION_TIMEOUT = 10 if not IS_PRODUCTION else 60  # Enterprise timeout
    MEMORY_LIMIT = 512
    MAX_RESPONSE_SIZE = 50 * 1024 * 1024  # 50MB
    
    # Database configuration
    if IS_VERCEL:
        DATABASE_URL = os.environ.get("POSTGRES_URL_POOLING")  # Use pooling URL
        REDIS_URL = os.environ.get("KV_REST_API_URL")
    else:
        DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://localhost/etf_dev")
        REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
    
    # Feature flags
    ENABLE_STREAMING = os.environ.get("ENABLE_STREAMING", "true") == "true"
    ENABLE_EDGE_CACHE = os.environ.get("ENABLE_EDGE_CACHE", "true") == "true"
    
    # Connection pool settings
    DB_POOL_SIZE = 5 if IS_VERCEL else 20
    DB_POOL_TIMEOUT = 8 if IS_VERCEL else 30
```

### Rollout Strategy with Vercel

#### Preview Deployments
```bash
# Deploy to preview environment
vercel --env preview

# Test specific branch
vercel --scope team-name --env preview
```

#### Gradual Rollout with Skew Protection
```python
# api/middleware.py
async def feature_flag_middleware(request: Request, call_next):
    """Control feature rollout percentage"""
    
    # Use Vercel Edge Config for dynamic feature flags
    if should_use_async_mode(request):
        request.state.async_mode = True
    else:
        request.state.async_mode = False
    
    response = await call_next(request)
    response.headers["X-Async-Mode"] = str(request.state.async_mode)
    
    return response

def should_use_async_mode(request: Request) -> bool:
    # Check feature flag
    if os.environ.get("FORCE_ASYNC_MODE") == "true":
        return True
    
    if os.environ.get("ASYNC_ROLLOUT_PERCENTAGE"):
        # Gradual rollout based on user ID or request hash
        rollout_pct = int(os.environ.get("ASYNC_ROLLOUT_PERCENTAGE", "0"))
        request_hash = hash(request.headers.get("x-forwarded-for", ""))
        return (request_hash % 100) < rollout_pct
    
    return False
```

### Monitoring and Alerting

#### Vercel Analytics Integration
```python
# utils/monitoring.py
from dataclasses import dataclass
from typing import Optional
import aiohttp

@dataclass
class VercelMetrics:
    function_name: str
    duration_ms: float
    memory_used_mb: float
    cold_start: bool
    status_code: int
    error: Optional[str] = None

async def report_to_vercel_analytics(metrics: VercelMetrics):
    """Report custom metrics to Vercel Analytics"""
    
    # Vercel automatically tracks some metrics
    # Send custom metrics to your monitoring service
    async with aiohttp.ClientSession() as session:
        await session.post(
            "https://api.vercel.com/v1/analytics/events",
            headers={
                "Authorization": f"Bearer {os.environ.get('VERCEL_ANALYTICS_TOKEN')}"
            },
            json={
                "name": "function_execution",
                "properties": {
                    "function": metrics.function_name,
                    "duration": metrics.duration_ms,
                    "memory": metrics.memory_used_mb,
                    "cold_start": metrics.cold_start,
                    "status": metrics.status_code,
                    "error": metrics.error
                }
            }
        )
```

## 10. Success Criteria

### Performance Metrics
- **Cold Start Time**: <1s for 90% of requests
- **Warm Response Time**: <2s for 95% of multi-ticker requests  
- **Memory Usage**: <400MB for 99% of requests
- **Timeout Rate**: <0.1% of all requests
- **Error Rate**: <0.5% excluding client errors

### Operational Metrics
- **Database Connection Reuse**: >90%
- **Edge Cache Hit Rate**: >70% for popular endpoints
- **Deployment Success Rate**: 100% (no failed deployments)
- **Rollback Time**: <2 minutes if needed

### Cost Metrics
- **Function Invocations**: Optimized to reduce by 30% through caching
- **Execution Time**: Reduced by 50% through async operations
- **Bandwidth**: Reduced by 40% through compression and caching

## Appendix: Vercel-Specific Resources

### Useful Vercel Features
- **Edge Config**: Dynamic configuration without redeploys
- **Vercel KV**: Redis-compatible edge storage
- **Vercel Postgres**: Managed PostgreSQL with connection pooling
- **Vercel Blob**: Object storage for large files
- **Vercel Analytics**: Built-in performance monitoring

### Common Pitfalls and Solutions
1. **Connection Pool Exhaustion**
   - Solution: Use connection pooling URLs, implement retry logic
2. **Memory Leaks in Long Operations**
   - Solution: Stream responses, process in chunks, explicit cleanup
3. **Cold Start Impact**
   - Solution: Implement warming, use Edge Functions where possible
4. **Response Size Limits**
   - Solution: Implement streaming, pagination, compression

### Migration Checklist
- [ ] Database migrated from SQLite to cloud database
- [ ] Connection pooling implemented and tested
- [ ] All endpoints converted to async
- [ ] Streaming implemented for large responses
- [ ] Edge functions deployed for lightweight operations
- [ ] Monitoring and analytics configured
- [ ] Load testing completed successfully
- [ ] Cost analysis performed and optimized
- [ ] Documentation updated with Vercel-specific details
- [ ] Rollback procedures tested and documented

This PRD provides a comprehensive roadmap for converting the ETF Research Platform API to an async architecture optimized specifically for Vercel's serverless environment, addressing all platform-specific constraints while maximizing performance.