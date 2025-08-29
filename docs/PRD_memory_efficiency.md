# PRD: Memory-Efficient Data Processing

## 1. Executive Summary

This PRD outlines a comprehensive strategy to optimize memory usage in the ETF Research Platform API, specifically targeting the serverless deployment constraints of Vercel's 512MB memory limit. The current implementation creates memory spikes when processing large DataFrames, particularly when handling multiple tickers over extended time periods.

**Key Objectives:**
- Reduce memory footprint by 50-70% through dtype optimization and chunked processing
- Implement streaming responses to prevent memory accumulation
- Ensure predictable memory patterns that stay well below 400MB threshold
- Maintain or improve processing performance while reducing memory usage

**Expected Impact:**
- Eliminate OOM errors in production
- Enable processing of 10+ years of data for multiple tickers
- Reduce serverless function costs through efficient resource utilization
- Improve API reliability and response times

## 2. Problem Statement

### Current Memory Issues

1. **DataFrame Memory Explosion**
   - Loading full historical data (10+ years) for multiple tickers creates DataFrames consuming 100-200MB each
   - `pd.concat()` operations in `cached_data_fetcher.py` duplicate data temporarily
   - No memory-efficient dtypes used (all float64/int64 by default)

2. **Inefficient Data Operations**
   - Multiple DataFrame copies during transformations
   - Full dataset loading before filtering
   - No chunked processing for large date ranges
   - Accumulation of intermediate results without cleanup

3. **API Response Buffering**
   - Converting entire DataFrames to JSON in memory
   - No streaming response mechanism
   - Large response objects held in memory until completion

4. **Lack of Memory Monitoring**
   - No visibility into memory usage patterns
   - Unable to predict memory requirements for requests
   - No early warning system for approaching limits

## 3. Goals & Success Metrics

### Primary Goals

1. **Memory Efficiency**
   - Stay under 400MB memory usage for all standard operations
   - Reduce per-ticker memory footprint by 60%
   - Enable processing of 20+ tickers with 10 years of data

2. **Performance Maintenance**
   - No more than 10% increase in response times
   - Maintain sub-5 second response for typical requests
   - Support concurrent request handling

3. **Reliability**
   - Zero OOM errors in production
   - Graceful degradation for extreme requests
   - Predictable memory usage patterns

### Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Peak Memory Usage | 450-512MB | <400MB | Memory profiler |
| Per-Ticker Memory | 50-100MB | 20-40MB | Heap analysis |
| OOM Error Rate | 5-10% | 0% | Error logs |
| P95 Response Time | 4.5s | <5s | APM metrics |
| Max Concurrent Requests | 2-3 | 5+ | Load testing |

## 4. Technical Requirements

### Memory Optimization Requirements

1. **DataFrame Dtype Optimization**
   - Use float32 instead of float64 for price data (sufficient precision)
   - Use int32 for volume data where appropriate
   - Implement categorical dtypes for repeated string values
   - Use date indexing efficiently

2. **Chunked Processing**
   - Implement configurable chunk sizes (e.g., 1000 rows)
   - Process data in streaming fashion
   - Avoid loading entire datasets when possible
   - Implement sliding window operations

3. **Memory-Conscious Operations**
   - Use in-place operations where safe
   - Implement explicit garbage collection
   - Avoid unnecessary DataFrame copies
   - Use views instead of copies when possible

4. **Streaming Architecture**
   - Implement generator-based data processing
   - Stream JSON responses using chunked transfer encoding
   - Process and send data incrementally
   - Implement backpressure mechanisms

### Constraints

- Must maintain API compatibility
- Cannot compromise data accuracy
- Must work within Vercel's serverless constraints
- Should not require infrastructure changes

## 5. Implementation Plan

### Phase 1: DataFrame Dtype Optimization (Week 1)

**Objective:** Reduce memory footprint of existing DataFrames by 50%

**Tasks:**
1. Audit current dtype usage across all DataFrames
2. Implement dtype mapping configuration
3. Create dtype optimization utility functions
4. Update data loading to use optimized dtypes
5. Test precision impact on calculations

**Deliverables:**
- `memory_utils.py` with dtype optimization functions
- Updated data sources with dtype specifications
- Memory usage comparison report

### Phase 2: Chunked Processing Implementation (Week 2)

**Objective:** Enable processing of large datasets without loading all data into memory

**Tasks:**
1. Design chunking strategy for different operations
2. Implement chunked data fetching
3. Create chunked aggregation functions
4. Update cache manager for chunk-aware operations
5. Implement chunk size auto-tuning

**Deliverables:**
- `chunked_processor.py` module
- Updated `cached_data_fetcher.py` with chunking support
- Performance benchmarks

### Phase 3: Streaming Response Infrastructure (Week 3)

**Objective:** Stream API responses to prevent memory accumulation

**Tasks:**
1. Implement streaming JSON encoder
2. Create generator-based response builders
3. Update API endpoints for streaming
4. Implement client-side streaming handlers
5. Add progress indicators for long operations

**Deliverables:**
- `streaming_response.py` utilities
- Updated API endpoints
- Client examples

### Phase 4: Memory Profiling and Monitoring (Week 4)

**Objective:** Implement comprehensive memory monitoring and optimization validation

**Tasks:**
1. Integrate memory profiler
2. Create memory usage decorators
3. Implement memory threshold warnings
4. Add memory metrics to logging
5. Create memory optimization dashboard

**Deliverables:**
- Memory profiling infrastructure
- Monitoring dashboard
- Optimization validation report

## 6. Technical Design

### Dtype Optimization Strategy

```python
# Optimal dtype mapping for financial data
DTYPE_MAPPING = {
    'Open': 'float32',      # Price data: float32 provides sufficient precision
    'High': 'float32',      # for financial applications (7 decimal places)
    'Low': 'float32',
    'Close': 'float32',
    'Adj Close': 'float32',
    'Volume': 'int32',      # Volume rarely exceeds int32 range
    'ticker_symbol': 'category',  # Repeated strings as categories
    'source': 'category',
    'dividend_type': 'category'
}

# Memory savings example:
# float64 (8 bytes) → float32 (4 bytes): 50% reduction
# object (variable) → category (1-2 bytes): 80-90% reduction
```

### Chunking Architecture

```python
class ChunkedDataProcessor:
    def __init__(self, chunk_size: int = 1000):
        self.chunk_size = chunk_size
    
    def process_data_chunked(self, ticker: str, start_date: date, end_date: date):
        """Process data in chunks to minimize memory usage"""
        date_chunks = self._generate_date_chunks(start_date, end_date)
        
        for chunk_start, chunk_end in date_chunks:
            # Process chunk
            chunk_data = self._fetch_chunk(ticker, chunk_start, chunk_end)
            processed = self._process_chunk(chunk_data)
            
            # Yield results immediately
            yield processed
            
            # Explicit cleanup
            del chunk_data
            gc.collect()
```

### Streaming Response Pattern

```python
def stream_json_response(data_generator):
    """Stream JSON response using generator"""
    yield '{"data": ['
    
    first = True
    for chunk in data_generator:
        if not first:
            yield ','
        yield json.dumps(chunk)
        first = False
    
    yield ']}'
```

### Memory Management Patterns

```python
# Context manager for memory-intensive operations
@contextmanager
def memory_limit(max_memory_mb: int):
    """Enforce memory limit for operation"""
    initial_memory = get_memory_usage()
    
    try:
        yield
    finally:
        current_memory = get_memory_usage()
        if current_memory > max_memory_mb:
            # Force garbage collection
            gc.collect()
            
        # Log memory usage
        logger.info(f"Memory delta: {current_memory - initial_memory}MB")
```

## 7. Code Examples

### Efficient DataFrame Creation

```python
def create_optimized_dataframe(data: List[Dict]) -> pd.DataFrame:
    """Create memory-efficient DataFrame with optimized dtypes"""
    # Pre-allocate arrays with correct dtypes
    n_rows = len(data)
    
    # Use numpy arrays for efficiency
    arrays = {
        'Open': np.empty(n_rows, dtype=np.float32),
        'High': np.empty(n_rows, dtype=np.float32),
        'Low': np.empty(n_rows, dtype=np.float32),
        'Close': np.empty(n_rows, dtype=np.float32),
        'Volume': np.empty(n_rows, dtype=np.int32),
    }
    
    # Fill arrays efficiently
    for i, row in enumerate(data):
        arrays['Open'][i] = row['Open']
        arrays['High'][i] = row['High']
        arrays['Low'][i] = row['Low']
        arrays['Close'][i] = row['Close']
        arrays['Volume'][i] = row['Volume']
    
    # Create DataFrame from arrays
    df = pd.DataFrame(arrays)
    
    # Set index efficiently
    dates = pd.to_datetime([row['Date'] for row in data])
    df.index = dates
    
    return df
```

### Chunked Processing Loop

```python
def process_large_dataset_chunked(ticker: str, start_date: date, end_date: date, 
                                 chunk_days: int = 365):
    """Process large dataset in time-based chunks"""
    results = []
    current_date = start_date
    
    while current_date < end_date:
        chunk_end = min(current_date + timedelta(days=chunk_days), end_date)
        
        # Process chunk
        with memory_limit(100):  # Limit chunk processing to 100MB
            chunk_data = fetch_data(ticker, current_date, chunk_end)
            chunk_result = process_chunk(chunk_data)
            results.append(chunk_result)
            
            # Clean up chunk data immediately
            del chunk_data
        
        current_date = chunk_end + timedelta(days=1)
    
    # Combine results efficiently
    return combine_results(results)
```

### Streaming Generator Functions

```python
def generate_ticker_data_stream(tickers: List[str], start_date: date, end_date: date):
    """Generate ticker data as a stream to minimize memory usage"""
    for ticker in tickers:
        # Process one ticker at a time
        ticker_data = fetch_ticker_data(ticker, start_date, end_date)
        
        # Convert to memory-efficient format
        optimized_data = optimize_dataframe_memory(ticker_data)
        
        # Yield ticker result
        yield {
            'ticker': ticker,
            'data': dataframe_to_records(optimized_data),
            'stats': calculate_stats(optimized_data)
        }
        
        # Clean up before next ticker
        del ticker_data, optimized_data
        gc.collect()
```

### Memory-Conscious Concatenation

```python
def concat_dataframes_efficiently(dataframes: List[pd.DataFrame]) -> pd.DataFrame:
    """Concatenate DataFrames with minimal memory overhead"""
    if not dataframes:
        return pd.DataFrame()
    
    if len(dataframes) == 1:
        return dataframes[0]
    
    # Use concat with copy=False to avoid duplication
    result = pd.concat(dataframes, copy=False, sort=False)
    
    # Clear references to original dataframes
    dataframes.clear()
    
    # Remove duplicates in-place
    result = result[~result.index.duplicated(keep='last')]
    
    # Optimize memory usage
    return optimize_dataframe_memory(result)
```

## 8. Performance Impact

### Memory Usage Comparisons

| Operation | Current Memory | Optimized Memory | Reduction |
|-----------|---------------|-----------------|-----------|
| Load 1 year OHLCV | 8.5MB | 3.4MB | 60% |
| Load 10 years data | 85MB | 34MB | 60% |
| Process 20 tickers | 1700MB | 680MB | 60% |
| Concat operations | +200MB spike | +50MB spike | 75% |
| JSON serialization | +150MB | Streaming (5MB) | 97% |

### Processing Time Trade-offs

| Operation | Current Time | Optimized Time | Delta |
|-----------|-------------|----------------|-------|
| Simple query | 0.5s | 0.5s | 0% |
| Large dataset | 3.0s | 3.3s | +10% |
| Streaming response | N/A | 0.1s first byte | -90% TTFB |
| Memory cleanup | 0s | 0.1s | +0.1s |

### Scalability Improvements

- **Current**: Max 3 concurrent requests before OOM
- **Optimized**: 10+ concurrent requests supported
- **Memory per request**: 170MB → 40MB (76% reduction)
- **Max dataset size**: 5 years → 20+ years

## 9. Testing Strategy

### Memory Profiling Tests

```python
@memory_profile
def test_large_dataset_processing():
    """Test memory usage with large dataset"""
    # Baseline measurement
    initial_memory = get_memory_usage()
    
    # Process 10 years of data for 20 tickers
    tickers = generate_test_tickers(20)
    start_date = date(2014, 1, 1)
    end_date = date(2024, 1, 1)
    
    results = process_tickers_optimized(tickers, start_date, end_date)
    
    # Verify memory constraints
    peak_memory = get_peak_memory_usage()
    assert peak_memory < 400, f"Peak memory {peak_memory}MB exceeds limit"
    
    # Verify data integrity
    assert len(results) == 20
    assert all(validate_ticker_data(r) for r in results)
```

### Large Dataset Stress Tests

```python
def stress_test_memory_limits():
    """Stress test with increasing dataset sizes"""
    test_cases = [
        (5, 1),    # 5 tickers, 1 year
        (10, 5),   # 10 tickers, 5 years
        (20, 10),  # 20 tickers, 10 years
        (50, 10),  # 50 tickers, 10 years
    ]
    
    for num_tickers, years in test_cases:
        with memory_monitor() as monitor:
            process_test_case(num_tickers, years)
            
        assert monitor.peak_memory < 400
        assert monitor.oom_count == 0
```

### Edge Case Handling

```python
def test_edge_cases():
    """Test edge cases and boundary conditions"""
    # Empty dataset
    assert process_tickers_optimized([], date.today(), date.today()) == []
    
    # Single row dataset
    result = process_single_row_data()
    assert validate_result(result)
    
    # Maximum chunk size
    large_chunk = create_test_data(rows=10000)
    assert process_chunk(large_chunk).memory_usage < 100
    
    # Concurrent processing
    results = run_concurrent_requests(count=10)
    assert all(r.success for r in results)
```

## 10. Monitoring

### Memory Usage Metrics

```python
class MemoryMonitor:
    """Real-time memory monitoring for production"""
    
    def __init__(self):
        self.metrics = []
        self.alerts = []
    
    def record_metric(self, operation: str, memory_mb: float, duration: float):
        """Record memory usage metric"""
        metric = {
            'timestamp': datetime.utcnow(),
            'operation': operation,
            'memory_mb': memory_mb,
            'duration': duration,
            'memory_per_second': memory_mb / duration if duration > 0 else 0
        }
        self.metrics.append(metric)
        
        # Check thresholds
        if memory_mb > 350:
            self.trigger_alert('HIGH_MEMORY', f'{operation} used {memory_mb}MB')
    
    def get_dashboard_data(self):
        """Get data for monitoring dashboard"""
        return {
            'current_memory': get_current_memory(),
            'peak_memory_1h': max(m['memory_mb'] for m in self.recent_metrics(hours=1)),
            'avg_memory_1h': np.mean([m['memory_mb'] for m in self.recent_metrics(hours=1)]),
            'high_memory_operations': self.get_high_memory_operations(),
            'memory_trend': self.calculate_memory_trend()
        }
```

### OOM Error Tracking

```python
def track_oom_errors(func):
    """Decorator to track OOM errors"""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except MemoryError as e:
            # Log detailed context
            log_oom_error({
                'function': func.__name__,
                'args': str(args)[:100],
                'memory_at_error': get_current_memory(),
                'traceback': traceback.format_exc()
            })
            
            # Attempt recovery
            gc.collect()
            
            # Re-raise with context
            raise MemoryError(f"OOM in {func.__name__}: {get_current_memory()}MB used") from e
    
    return wrapper
```

### Performance Dashboards

```yaml
# Grafana Dashboard Configuration
memory_efficiency_dashboard:
  panels:
    - title: "Memory Usage Over Time"
      type: graph
      targets:
        - metric: api.memory.usage
        - metric: api.memory.peak
      
    - title: "Memory by Operation"
      type: bar_chart
      targets:
        - metric: api.memory.by_operation
      
    - title: "OOM Error Rate"
      type: stat
      targets:
        - metric: api.errors.oom_count
      
    - title: "Request Success Rate"
      type: gauge
      targets:
        - metric: api.requests.success_rate
      
    - title: "Memory Efficiency Score"
      type: stat
      targets:
        - metric: api.memory.efficiency_score
      
  alerts:
    - name: "High Memory Usage"
      condition: api.memory.usage > 350
      severity: warning
      
    - name: "OOM Errors Detected"
      condition: api.errors.oom_count > 0
      severity: critical
      
    - name: "Memory Leak Suspected"
      condition: api.memory.trend_1h > 50
      severity: warning
```

## Appendices

### A. Memory Profiling Tools

- **memory_profiler**: Line-by-line memory usage
- **tracemalloc**: Python's built-in memory tracking
- **pympler**: Advanced memory analysis
- **guppy3**: Heap analysis and profiling

### B. References

- [Pandas Memory Usage Optimization](https://pandas.pydata.org/docs/user_guide/scale.html)
- [Python Memory Management](https://docs.python.org/3/c-api/memory.html)
- [Vercel Serverless Limits](https://vercel.com/docs/concepts/limits/overview)
- [Streaming JSON Responses](https://www.python.org/dev/peps/pep-3333/#streaming-responses)

### C. Glossary

- **OOM**: Out of Memory error
- **TTFB**: Time to First Byte
- **Dtype**: Data type in pandas/numpy
- **Chunking**: Processing data in smaller pieces
- **Streaming**: Sending data progressively without buffering