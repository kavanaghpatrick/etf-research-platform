# PRD: Parallel Data Fetching Implementation

## 1. Executive Summary

### Overview of Parallel Fetching Strategy
The current implementation uses a sequential fallback pattern for data sources, resulting in significant delays when primary sources fail. This PRD proposes implementing a parallel data fetching architecture that queries multiple sources simultaneously, dramatically reducing response times while maintaining data quality and rate limit compliance.

### Expected API Response Time Improvements
- **Current State**: 10-20 seconds per ticker (sequential source fallback)
- **Target State**: 2-4 seconds per ticker (parallel execution)
- **Expected Improvement**: 70-80% reduction in response time
- **Batch Processing**: 50 tickers in ~15 seconds vs current ~300 seconds

### Cost-Benefit Analysis
**Benefits:**
- Improved user experience with faster data retrieval
- Better API utilization across multiple sources
- Increased reliability through concurrent fallback
- Real-time source health monitoring
- Optimized API costs through intelligent routing

**Costs:**
- Redis infrastructure for global rate limiting
- Increased code complexity
- Initial development effort (~40 hours)
- Ongoing monitoring and maintenance

## 2. Problem Statement

### Current Issues
1. **Sequential Source Fallback Causing 10-20s Delays**
   - Each source timeout adds 5-10 seconds
   - Failed sources are retried unnecessarily
   - No circuit breaker pattern for failing sources

2. **Inefficient Use of Multiple Data Sources**
   - Sources queried one by one
   - No parallel execution capability
   - Cache checks happen before each API call

3. **Rate Limiting Not Coordinated Globally**
   - Each source manages its own rate limits
   - No global view of API usage
   - Risk of hitting limits during peak usage

### Impact
- Poor user experience with slow data retrieval
- Unnecessary API calls to failing sources
- Suboptimal resource utilization
- Higher operational costs

## 3. Goals & Success Metrics

### Primary Goals
1. **Reduce Data Fetch Time by 70%**
   - Target: 2-4 seconds per ticker
   - Batch operations under 20 seconds for 50 tickers

2. **Maintain Rate Limit Compliance**
   - Zero rate limit violations
   - Intelligent request distribution
   - Global rate limit awareness

3. **Optimize API Usage Costs**
   - Reduce unnecessary API calls by 40%
   - Prioritize cost-effective sources
   - Cache hit rate above 60%

### Success Metrics
- **Performance**: P95 response time < 4 seconds
- **Reliability**: 99.9% uptime for data fetching
- **Efficiency**: API call reduction of 40%
- **Cost**: 30% reduction in API costs
- **User Satisfaction**: Response time complaints reduced by 80%

## 4. Technical Requirements

### Implement Parallel Source Querying with Fallback
- Async/await pattern for concurrent execution
- Configurable timeout per source (default 3 seconds)
- First successful response wins
- Automatic fallback to next available source
- Support for partial data merging

### Global Rate Limiter Using Redis
- Centralized rate limit tracking
- Token bucket algorithm implementation
- Per-source and global limits
- Real-time usage monitoring
- Graceful degradation when limits approached

### Circuit Breaker Pattern for Failing Sources
- Automatic source disabling after consecutive failures
- Configurable failure threshold (default: 3 failures)
- Exponential backoff for recovery attempts
- Health check endpoints
- Manual override capability

### Intelligent Source Selection Based on Data Availability
- Historical success rate tracking
- Cost-per-request optimization
- Data quality scoring
- Geographic proximity routing
- Time-of-day optimization

## 5. Implementation Plan

### Phase 1: Parallel Fetching Infrastructure (Week 1-2)
- Implement AsyncDataFetcher class
- Add concurrent execution with asyncio
- Create parallel fetch orchestrator
- Unit tests for concurrent operations
- Performance benchmarking

### Phase 2: Redis Rate Limiter Integration (Week 3)
- Set up Redis infrastructure
- Implement token bucket rate limiter
- Add global rate limit manager
- Create rate limit monitoring dashboard
- Integration tests

### Phase 3: Source Health Monitoring (Week 4)
- Implement circuit breaker pattern
- Add health check endpoints
- Create source status dashboard
- Set up alerting for source failures
- Historical metrics collection

### Phase 4: Cost Optimization Logic (Week 5)
- Implement cost tracking per source
- Add intelligent routing algorithm
- Create cost optimization engine
- Build cost monitoring dashboard
- A/B testing framework

## 6. Architecture Design

### Parallel Execution Flow Diagram
```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Client    │────▶│ Parallel Fetcher│────▶│ Rate Limiter │
└─────────────┘     └────────┬────────┘     └──────┬───────┘
                             │                      │
                    ┌────────┴────────┐            │
                    ▼        ▼        ▼            ▼
              ┌─────────┐┌─────────┐┌─────────┐┌────────┐
              │AlphaVan ││ Tiingo  ││YFinance ││ Redis  │
              └─────────┘└─────────┘└─────────┘└────────┘
                    │        │        │
                    └────────┴────────┘
                             │
                    ┌────────▼────────┐
                    │ Response Merger │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Cache Manager  │
                    └─────────────────┘
```

### Rate Limiting Strategy
- **Global Limits**: 1000 requests/minute across all sources
- **Per-Source Limits**: 
  - AlphaVantage: 5 requests/minute (25 daily)
  - Tiingo: 50 requests/minute (1000 monthly)
  - YFinance: 100 requests/minute (no limit)
  - Finnhub: 10 requests/minute (200 monthly)
  - Polygon: 50 requests/minute (100 daily)

### Error Handling and Fallback Logic
1. Primary source timeout (3s) → Try secondary sources
2. All sources fail → Return cached data if available
3. No cached data → Return error with detailed message
4. Circuit breaker open → Skip failed source
5. Rate limit exceeded → Queue request or return 429

### Source Priority Algorithm
```python
priority_score = (
    success_rate * 0.4 +
    (1 - normalized_cost) * 0.3 +
    data_quality * 0.2 +
    (1 - normalized_latency) * 0.1
)
```

## 7. Code Examples

### Parallel Fetching with asyncio
```python
class ParallelDataFetcher:
    async def fetch_parallel(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        tasks = []
        for source in self.active_sources:
            if await self.rate_limiter.can_request(source.name):
                task = asyncio.create_task(
                    self._fetch_with_timeout(source, ticker, start_date, end_date)
                )
                tasks.append((source.name, task))
        
        # Wait for first successful response
        for completed in asyncio.as_completed([t[1] for t in tasks], timeout=5.0):
            try:
                result = await completed
                if result is not None and not result.empty:
                    # Cancel remaining tasks
                    for _, task in tasks:
                        if not task.done():
                            task.cancel()
                    return result
            except Exception as e:
                logger.warning(f"Source failed: {e}")
                continue
        
        raise Exception("All sources failed")
```

### Rate Limiter Implementation
```python
class RedisRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.limits = {
            'AlphaVantage': {'per_minute': 5, 'daily': 25},
            'Tiingo': {'per_minute': 50, 'monthly': 1000},
            'YFinance': {'per_minute': 100},
            'global': {'per_minute': 1000}
        }
    
    async def can_request(self, source: str) -> bool:
        # Check global limit
        global_key = f"rate_limit:global:{int(time.time() / 60)}"
        global_count = await self.redis.incr(global_key)
        await self.redis.expire(global_key, 60)
        
        if global_count > self.limits['global']['per_minute']:
            return False
        
        # Check source-specific limit
        source_key = f"rate_limit:{source}:{int(time.time() / 60)}"
        source_count = await self.redis.incr(source_key)
        await self.redis.expire(source_key, 60)
        
        return source_count <= self.limits.get(source, {}).get('per_minute', float('inf'))
```

### Circuit Breaker Pattern
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_timeout=60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failures = defaultdict(int)
        self.last_failure_time = {}
        self.state = defaultdict(lambda: 'closed')  # closed, open, half_open
    
    async def call(self, source_name: str, func, *args, **kwargs):
        if self.state[source_name] == 'open':
            if time.time() - self.last_failure_time[source_name] > self.recovery_timeout:
                self.state[source_name] = 'half_open'
            else:
                raise CircuitBreakerOpenError(f"{source_name} circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            if self.state[source_name] == 'half_open':
                self.state[source_name] = 'closed'
                self.failures[source_name] = 0
            return result
        except Exception as e:
            self.failures[source_name] += 1
            self.last_failure_time[source_name] = time.time()
            
            if self.failures[source_name] >= self.failure_threshold:
                self.state[source_name] = 'open'
                logger.error(f"Circuit breaker opened for {source_name}")
            
            raise e
```

### Source Selection Logic
```python
class IntelligentSourceSelector:
    def __init__(self, metrics_store):
        self.metrics = metrics_store
    
    def select_sources(self, ticker: str) -> List[DataSource]:
        source_scores = []
        
        for source in self.all_sources:
            metrics = self.metrics.get_source_metrics(source.name, ticker)
            
            score = self.calculate_priority_score(
                success_rate=metrics['success_rate'],
                cost_per_request=metrics['cost'],
                data_quality=metrics['quality_score'],
                avg_latency=metrics['avg_latency']
            )
            
            source_scores.append((source, score))
        
        # Sort by score descending
        source_scores.sort(key=lambda x: x[1], reverse=True)
        
        # Return top sources that are currently healthy
        return [s[0] for s in source_scores if self.circuit_breaker.is_healthy(s[0].name)]
```

## 8. Dependencies & Risks

### Redis Infrastructure Requirements
- Redis 6.0+ for optimal performance
- Minimum 2GB RAM allocation
- Redis Sentinel for high availability
- Backup strategy for rate limit data
- Connection pooling configuration

### Network Concurrency Limits
- OS-level file descriptor limits
- Python asyncio event loop tuning
- Connection pool sizing per source
- DNS resolution caching
- SSL/TLS session reuse

### API Quota Management
- Real-time quota tracking
- Predictive quota usage
- Quota reset time awareness
- Emergency quota reservation
- Cross-tenant quota sharing

### Risks and Mitigation
1. **Risk**: Redis single point of failure
   - **Mitigation**: Redis Sentinel with automatic failover

2. **Risk**: Thundering herd on cache miss
   - **Mitigation**: Request coalescing and jitter

3. **Risk**: Source API changes
   - **Mitigation**: Version detection and adapter pattern

4. **Risk**: Network saturation
   - **Mitigation**: Adaptive concurrency limits

## 9. Testing Strategy

### Load Testing Scenarios
1. **Baseline Performance**
   - 100 concurrent ticker requests
   - Measure response times and success rates
   - Compare with current implementation

2. **Stress Testing**
   - 1000 concurrent requests
   - Gradual load increase
   - Identify breaking points

3. **Spike Testing**
   - Sudden load increase from 10 to 500 requests
   - Recovery time measurement
   - Queue behavior validation

### Rate Limit Compliance Testing
1. **Source Limit Testing**
   - Verify each source respects its limits
   - Test limit reset behavior
   - Validate quota tracking accuracy

2. **Global Limit Testing**
   - Ensure global limits are enforced
   - Test limit distribution fairness
   - Validate queue behavior at limits

### Failure Mode Testing
1. **Source Failure Scenarios**
   - Single source timeout
   - Multiple source failures
   - All sources unavailable
   - Network partition testing

2. **Circuit Breaker Testing**
   - Failure threshold validation
   - Recovery timeout testing
   - Half-open state transitions
   - Manual override functionality

3. **Redis Failure Testing**
   - Redis unavailability
   - Fallback to local rate limiting
   - Recovery after Redis returns
   - Data consistency validation

## 10. Monitoring & Observability

### Metrics to Track
1. **Performance Metrics**
   - Request latency (P50, P95, P99)
   - Throughput (requests/second)
   - Success rate per source
   - Cache hit ratio
   - Queue depth and wait times

2. **Resource Metrics**
   - CPU and memory usage
   - Network bandwidth utilization
   - Redis connection pool stats
   - AsyncIO task counts
   - File descriptor usage

3. **Business Metrics**
   - API costs per source
   - Data freshness scores
   - User satisfaction scores
   - Error rates by type
   - SLA compliance

### Alerting Thresholds
1. **Critical Alerts**
   - Response time > 10s (P95)
   - Success rate < 95%
   - Redis unavailable
   - All sources failing
   - Rate limit violations

2. **Warning Alerts**
   - Response time > 5s (P95)
   - Success rate < 99%
   - Circuit breaker opened
   - High queue depth (>100)
   - Approaching rate limits (80%)

### Performance Dashboards
1. **Real-time Dashboard**
   - Current request rate
   - Active sources status
   - Response time trends
   - Error rate by source
   - Queue status

2. **Historical Dashboard**
   - Daily/weekly trends
   - Source reliability history
   - Cost analysis
   - Cache effectiveness
   - User behavior patterns

3. **Operations Dashboard**
   - Circuit breaker states
   - Rate limit usage
   - Redis cluster health
   - Network metrics
   - Deployment status

### Implementation Timeline
- **Week 1-2**: Core parallel fetching
- **Week 3**: Redis integration
- **Week 4**: Monitoring and circuit breakers
- **Week 5**: Cost optimization and testing
- **Week 6**: Production rollout and monitoring

### Success Criteria
- 70% reduction in average response time
- Zero rate limit violations in production
- 40% reduction in API costs
- 99.9% availability SLA met
- Positive user feedback on performance