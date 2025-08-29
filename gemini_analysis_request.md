# ETF Research Platform API Optimization Analysis Request

## Project Overview
Professional ETF research platform with FastAPI backend serving financial data to Next.js frontend. Focus: optimizing price data collection and serving performance.

## Current Architecture

### Core Components
- **FastAPI Backend**: Python 3.9+ with asyncio
- **Multi-Source Data**: AlphaVantage, Tiingo, YFinance, Finnhub, Polygon
- **Caching**: SQLite (local) / PostgreSQL (production)
- **Deployment**: Vercel serverless functions
- **Frontend**: Next.js 15 with React 19

### Data Flow
1. User requests ticker data via frontend
2. FastAPI receives request, checks cache
3. Identifies missing date ranges using gap detection
4. Fetches missing data from APIs (sequential fallback)
5. Combines cached + fresh data, returns to frontend
6. Frontend renders interactive charts

## Performance Issues

### Critical Bottlenecks
1. **Sequential Data Source Fallback**: Each source tried one-by-one, high latency
2. **SQLite Concurrency**: Issues with dividend processing during batch operations  
3. **No Connection Pooling**: Each request creates new DB connections
4. **Inefficient Rate Limiting**: Per-source but not globally optimized
5. **Memory Spikes**: Large datasets (5+ years) cause 512MB limit issues
6. **No Streaming**: Large responses sent as single payload
7. **Timeout Issues**: 10s Vercel limit for complex multi-ticker requests

### Code Examples

#### Current Data Fetching (Sequential)
```python
# cached_data_fetcher.py - Line 90-119
for missing_range in missing_ranges:
    for source in self.sources:  # Sequential, blocks on failures
        try:
            if source.is_available():
                api_data = source.fetch_data(ticker, start_date, end_date)
                if not api_data.empty:
                    break  # Only first successful source used
        except Exception as e:
            continue  # Try next source
```

#### Rate Limiting (Per-Source)
```python
# simple_data_sources.py - Line 57-68
def _rate_limit(self):
    with self._lock:  # Thread safety but no global coordination
        if time_since_last < self._min_interval:
            time.sleep(self._min_interval - time_since_last)
        self._request_count += 1  # Per-source tracking only
```

#### Memory-Intensive Processing
```python
# cached_data_fetcher.py - Line 122-130
all_data_frames = [cached_data] + api_data_frames
combined_data = pd.concat(all_data_frames).sort_index()  # Memory spike
combined_data = combined_data[~combined_data.index.duplicated(keep='last')]
```

## Optimization Requests

### Immediate Performance Improvements
1. **Parallel Data Fetching**: How to fetch from multiple sources simultaneously?
2. **Connection Pooling**: Best practices for serverless database connections?
3. **Streaming Responses**: Implement chunked data transfer for large datasets?
4. **Memory Optimization**: Process large DataFrames without memory spikes?
5. **Global Rate Limiting**: Coordinate rate limits across all sources efficiently?

### Scalability & Architecture
1. **Redis Integration**: Worth implementing for high-frequency cache access?
2. **Database Schema**: Optimal time-series data structure for PostgreSQL?
3. **Async Operations**: Best patterns for async database operations in FastAPI?
4. **Error Recovery**: Robust failover strategies for data source failures?
5. **Real-time Updates**: Efficiently serve live market data?

### Deployment & Monitoring
1. **Serverless Optimization**: Work within Vercel's 10s/512MB constraints?
2. **Data Compression**: Compress API responses for large historical datasets?
3. **Health Monitoring**: Real-time tracking of data source performance?
4. **Cost Optimization**: Minimize API usage while maintaining data freshness?

## Current Constraints

### Technical Limits
- **Vercel Serverless**: 10 second timeout, 512MB memory
- **Free Tier APIs**: Limited requests/day, strict rate limits
- **No Persistent Storage**: Serverless functions are stateless
- **Cold Start Latency**: Function initialization delays

### Performance Targets
- **Response Time**: <2s cached, <10s fresh data
- **Cache Hit Rate**: 90%+ for historical data
- **Concurrency**: 100+ simultaneous users
- **Reliability**: 99.9% uptime
- **Cost**: Minimize API usage costs

## Specific Questions for Analysis

### Architecture Decisions
1. Should we implement Redis/Upstash for distributed caching?
2. Is connection pooling beneficial in stateless serverless functions?
3. How to handle API rate limits across multiple serverless instances?
4. Best practices for pandas memory management in constrained environments?

### Performance Optimization
1. Implement parallel API fetching without violating rate limits?
2. Stream large datasets efficiently to frontend?
3. Optimize database queries for time-series data patterns?
4. Handle graceful degradation when data sources fail?

### Monitoring & Reliability
1. Real-time monitoring of data source health and performance?
2. Intelligent retry strategies for failed API requests?
3. Alerting system for data quality issues?
4. Backup data source strategies?

## Current Code Structure

### Key Files
- `main.py`: FastAPI endpoints, request handling
- `cached_data_fetcher.py`: Cache-first data fetching with gap detection
- `simple_data_sources.py`: Individual data source implementations
- `sqlite_cache_manager.py`: Local cache management
- `total_return_calculator.py`: Dividend calculations

### Pain Points in Code
1. **No parallelization** in data fetching loops
2. **Synchronous database operations** blocking event loop
3. **Large DataFrame concatenations** causing memory issues
4. **No circuit breakers** for failing data sources
5. **Limited error context** for debugging API failures

## Desired Outcomes

### Performance Improvements
- 50% reduction in average API response time
- 90%+ cache hit rate for historical data requests
- Support 10x more concurrent users
- Eliminate timeout errors for large datasets

### Operational Excellence
- Comprehensive monitoring and alerting
- Graceful handling of data source failures
- Reduced API costs through intelligent caching
- Real-time data quality monitoring

### Development Efficiency
- Cleaner async/await patterns
- Better error handling and logging
- Simplified deployment and scaling
- Robust testing for edge cases

Please provide specific, actionable recommendations with code examples where applicable. Focus on solutions that work within our serverless constraints while maximizing performance and reliability.