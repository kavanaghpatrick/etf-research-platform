# PRD: Async Architecture Conversion

## 1. Executive Summary

This document outlines the conversion of the ETF Research Platform API from a synchronous to an asynchronous architecture. The primary goal is to improve performance, reduce response times, and better handle concurrent requests while maintaining backward compatibility.

### Key Benefits
- **3-5x performance improvement** for multi-ticker requests
- **Reduced serverless timeout risks** on Vercel (10s timeout)
- **Better resource utilization** through non-blocking I/O
- **Improved scalability** for handling multiple concurrent users

### Risk Assessment
- **Low Risk**: Existing API contracts remain unchanged
- **Medium Complexity**: Requires careful handling of database connections
- **High Impact**: Significant performance improvements expected

## 2. Problem Statement

### Current Synchronous Blocking Issues
1. **Sequential API Calls**: When fetching data for multiple tickers, each external API call blocks the thread
2. **Database Bottlenecks**: SQLite operations block during cache reads/writes
3. **Poor Concurrency**: Cannot efficiently handle multiple simultaneous requests
4. **Timeout Risks**: Long-running operations risk hitting Vercel's 10-second timeout

### Performance Bottlenecks in Request Handling
- `/data/fetch` endpoint processes tickers sequentially
- Dividend calculations block while fetching historical data
- Cache operations cannot be parallelized effectively
- External API rate limiting causes unnecessary blocking

### Serverless Timeout Constraints
- Vercel Functions have a 10-second timeout on the Hobby plan
- Current implementation risks timeout when fetching 5+ tickers
- No ability to stream partial results

## 3. Goals & Success Metrics

### Specific Performance Targets
- **Response Time**: Reduce multi-ticker fetch time by 60-70%
- **Concurrency**: Handle 10x more concurrent requests
- **Timeout Prevention**: Ensure 99% of requests complete within 8 seconds
- **Cache Efficiency**: Parallel cache lookups reduce overhead by 50%

### Measurable Outcomes
- Average response time for 10-ticker request: <3 seconds (from ~8 seconds)
- P95 latency: <5 seconds
- Concurrent request capacity: 100+ (from ~10)
- API timeout rate: <1% (from ~5%)

### Timeline Expectations
- Phase 1 (Core Conversion): 2 days
- Phase 2 (Data Fetcher): 1 day
- Phase 3 (Database): 1 day
- Phase 4 (Testing): 1 day
- **Total**: 5 days

## 4. Technical Requirements

### Convert all endpoints from `def` to `async def`
All FastAPI endpoints must be converted to async functions:
```python
# Before
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# After
@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

### Implement `asyncio.gather()` for concurrent operations
Parallelize independent operations:
```python
# Fetch multiple tickers concurrently
results = await asyncio.gather(
    *[fetch_ticker_data(ticker) for ticker in tickers],
    return_exceptions=True
)
```

### Use `asyncio.to_thread()` for blocking I/O
Wrap synchronous operations that cannot be made async:
```python
# Database operations
result = await asyncio.to_thread(
    cache_manager.get_cached_data,
    ticker, start_date, end_date
)
```

### Maintain backward compatibility
- All API endpoints maintain the same URL structure
- Response formats remain unchanged
- Error handling patterns preserved

## 5. Implementation Plan

### Phase 1: Core endpoint conversion (Priority: High)
1. Convert all FastAPI route handlers to async
2. Update simple endpoints first (health, root, status)
3. Implement async wrapper for synchronous data fetcher
4. Add proper error handling for async operations

### Phase 2: Data fetcher async methods (Priority: High)
1. Create `AsyncCachedDataFetcher` class
2. Implement concurrent ticker fetching with `asyncio.gather()`
3. Add async cache lookup methods
4. Implement parallel API calls with rate limiting

### Phase 3: Database operations (Priority: Medium)
1. Add async wrappers for SQLite operations using `asyncio.to_thread()`
2. Implement connection pooling for PostgreSQL (if used)
3. Create async cache manager interface
4. Add concurrent cache writes with proper locking

### Phase 4: Testing and validation (Priority: High)
1. Unit tests for all async endpoints
2. Integration tests for concurrent operations
3. Performance benchmarking suite
4. Load testing with multiple concurrent requests

## 6. Code Examples

### Before/after code snippets

#### Endpoint Conversion
```python
# BEFORE: Synchronous endpoint
@app.post("/data/fetch")
def fetch_ticker_data(request: DataFetchRequest):
    results = fetch_real_data(request.tickers, request.start_date, request.end_date)
    return {"status": "success", "data": results}

# AFTER: Asynchronous endpoint
@app.post("/data/fetch")
async def fetch_ticker_data(request: DataFetchRequest):
    results = await fetch_real_data(request.tickers, request.start_date, request.end_date)
    return {"status": "success", "data": results}
```

#### Multiple Ticker Fetching
```python
# BEFORE: Sequential processing
for ticker in tickers:
    result = self.fetch_ticker_data(ticker, start_date, end_date)
    results.append(result)

# AFTER: Concurrent processing
tasks = [self.fetch_ticker_data(ticker, start_date, end_date) for ticker in tickers]
results = await asyncio.gather(*tasks, return_exceptions=True)
```

### Key async patterns to implement

#### Async Context Manager for Database
```python
class AsyncCacheManager:
    async def __aenter__(self):
        self.conn = await asyncio.to_thread(self._get_connection)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await asyncio.to_thread(self.conn.close)
```

#### Rate-Limited Async API Calls
```python
class AsyncRateLimiter:
    def __init__(self, rate: int, per: float):
        self.rate = rate
        self.per = per
        self.allowance = rate
        self.last_check = time.monotonic()
        self._lock = asyncio.Lock()
    
    async def acquire(self):
        async with self._lock:
            current = time.monotonic()
            time_passed = current - self.last_check
            self.last_check = current
            self.allowance += time_passed * (self.rate / self.per)
            if self.allowance > self.rate:
                self.allowance = self.rate
            if self.allowance < 1.0:
                sleep_time = (1.0 - self.allowance) * (self.per / self.rate)
                await asyncio.sleep(sleep_time)
                self.allowance = 0.0
            else:
                self.allowance -= 1.0
```

### Error handling strategies

#### Async Exception Handling
```python
async def fetch_with_fallback(ticker: str, sources: List[DataSource]):
    for source in sources:
        try:
            return await source.fetch_async(ticker)
        except Exception as e:
            logger.warning(f"{source.name} failed for {ticker}: {e}")
            continue
    raise HTTPException(status_code=503, detail=f"All sources failed for {ticker}")
```

#### Timeout Protection
```python
async def fetch_with_timeout(ticker: str, timeout: float = 5.0):
    try:
        return await asyncio.wait_for(
            fetch_ticker_data(ticker),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        logger.error(f"Timeout fetching {ticker}")
        return None
```

## 7. Dependencies & Risks

### Required library updates
- FastAPI: Already supports async (no update needed)
- SQLite: Use `aiosqlite` for async support
- PostgreSQL: Use `asyncpg` for async support
- HTTP Clients: Use `httpx` for async HTTP requests

### Potential breaking changes
- Database connection handling must be refactored
- Third-party API clients may need async versions
- Some synchronous libraries have no async alternatives

### Mitigation strategies
1. **Gradual Migration**: Convert endpoints incrementally
2. **Feature Flags**: Toggle between sync/async implementations
3. **Fallback Mechanisms**: Keep sync versions as fallback
4. **Thorough Testing**: Comprehensive test suite before deployment

## 8. Testing Strategy

### Unit test requirements
- Test each async endpoint individually
- Mock external API calls with async fixtures
- Test timeout handling and cancellation
- Verify error propagation in async context

### Integration testing approach
```python
@pytest.mark.asyncio
async def test_concurrent_ticker_fetch():
    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]
    start_time = time.time()
    
    results = await fetch_multiple_tickers_async(tickers)
    
    elapsed = time.time() - start_time
    assert elapsed < 3.0  # Should complete in under 3 seconds
    assert len(results) == 5
```

### Performance benchmarking
```python
# Benchmark script
async def benchmark_async_performance():
    scenarios = [
        {"name": "Single ticker", "tickers": ["AAPL"]},
        {"name": "5 tickers", "tickers": ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]},
        {"name": "10 tickers", "tickers": [...]}  # 10 tickers
    ]
    
    for scenario in scenarios:
        # Test sync version
        sync_time = measure_sync_performance(scenario["tickers"])
        
        # Test async version
        async_time = await measure_async_performance(scenario["tickers"])
        
        improvement = (sync_time - async_time) / sync_time * 100
        print(f"{scenario['name']}: {improvement:.1f}% improvement")
```

## 9. Rollout Plan

### Deployment strategy
1. **Development Environment**: Full async implementation
2. **Staging Deployment**: A/B testing with 10% traffic
3. **Production Canary**: 25% → 50% → 100% over 48 hours
4. **Monitoring**: Real-time performance metrics

### Feature flags/gradual rollout
```python
# Environment variable control
ASYNC_MODE = os.getenv("ENABLE_ASYNC_MODE", "false").lower() == "true"

@app.post("/data/fetch")
async def fetch_ticker_data(request: DataFetchRequest):
    if ASYNC_MODE:
        return await fetch_ticker_data_async(request)
    else:
        return await asyncio.to_thread(fetch_ticker_data_sync, request)
```

### Rollback procedures
1. **Immediate Rollback**: Toggle `ENABLE_ASYNC_MODE=false`
2. **Code Rollback**: Previous version tagged and ready
3. **Database Rollback**: No schema changes, safe to revert
4. **Monitoring Alerts**: Automatic rollback on error rate spike

### Success Criteria for Full Rollout
- Error rate remains below 0.1%
- P95 latency improved by >50%
- No increase in timeout errors
- Positive performance metrics for 48 hours

## Appendix: Technical Considerations

### Connection Pooling
```python
# Async connection pool for PostgreSQL
async def create_pool():
    return await asyncpg.create_pool(
        DATABASE_URL,
        min_size=10,
        max_size=20,
        command_timeout=60
    )
```

### Async Cache Implementation
```python
class AsyncCache:
    def __init__(self, backend):
        self.backend = backend
        self._lock = asyncio.Lock()
    
    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            return await asyncio.to_thread(self.backend.get, key)
    
    async def set(self, key: str, value: Any, ttl: int = 3600):
        async with self._lock:
            await asyncio.to_thread(self.backend.set, key, value, ttl)
```

### Monitoring and Observability
- Add async-aware APM (Application Performance Monitoring)
- Track concurrent request counts
- Monitor event loop lag
- Log slow async operations

This PRD provides a comprehensive roadmap for converting the ETF Research Platform API to an async architecture while maintaining reliability and backward compatibility.