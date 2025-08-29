# Async Implementation Testing Suite

This directory contains comprehensive tests for the async architecture implementation, including unit tests, integration tests, performance benchmarks, and Vercel-specific compliance tests.

## Test Files

### `test_async_implementation.py`
Main test suite containing:
- **TestAsyncEndpoints**: Tests for async endpoint functionality
- **TestPerformanceBenchmarks**: Performance comparison tests (sync vs async)
- **TestConcurrencyStressTests**: Concurrency and stress testing
- **TestTimeoutHandling**: Timeout and graceful degradation tests
- **TestMemoryUsage**: Memory usage and leak detection
- **TestErrorPropagation**: Error handling and fault tolerance
- **TestVercelSpecificOptimizations**: Vercel platform compliance

### `async_performance_benchmark.py`
Performance benchmark suite that:
- Compares sync vs async performance
- Measures response times for different ticker counts
- Tracks memory usage patterns
- Tests concurrent load handling
- Generates performance reports and charts

### `conftest.py`
Pytest configuration and fixtures:
- Async HTTP client fixtures
- Test data factories
- Performance monitoring utilities
- Vercel compliance assertions

## Running Tests

### Quick Start

```bash
# Run all async tests
python run_async_tests.py

# Run specific test types
python run_async_tests.py --type unit
python run_async_tests.py --type integration
python run_async_tests.py --type performance
python run_async_tests.py --type stress
python run_async_tests.py --type vercel

# Generate comprehensive report
python run_async_tests.py --report
```

### Manual Test Execution

```bash
# Run with pytest directly
pytest test_async_implementation.py -v

# Run specific test class
pytest test_async_implementation.py::TestAsyncEndpoints -v

# Run performance benchmarks
python async_performance_benchmark.py
```

### Test Configuration

Tests are configured via `pytest.ini` with:
- Async mode enabled
- Coverage reporting
- Custom markers for test categorization
- Timeout handling
- Warning filters

## Test Categories

### Unit Tests
- Test individual async endpoints
- Verify response formats and data integrity
- Test error handling for invalid inputs
- Validate timeout behavior

### Integration Tests
- Test end-to-end request flows
- Verify database integration
- Test external API integration
- Validate caching mechanisms

### Performance Tests
- Compare sync vs async performance
- Measure response times across different loads
- Test memory usage patterns
- Validate Vercel compliance (timeout, memory limits)

### Stress Tests
- High concurrent request handling
- Resource exhaustion testing
- Connection pool efficiency
- Memory leak detection

### Vercel-Specific Tests
- 10-second timeout compliance
- 512MB memory limit compliance
- Cold start performance
- Edge function optimization
- Stale-while-revalidate caching

## Key Test Scenarios

### Performance Benchmarks
```python
# Test concurrent ticker fetching
async def test_concurrent_ticker_fetch()

# Test timeout handling
async def test_timeout_handling()

# Test memory limits
async def test_memory_limits()

# Test database concurrency
async def test_database_concurrency()

# Test performance improvement
async def test_performance_improvement()
```

### Load Testing
- **Concurrent Users**: 10-50 simultaneous users
- **Request Volume**: 5-20 requests per user
- **Ticker Counts**: 1, 5, 10, 20 tickers per request
- **Duration**: 60-300 seconds

### Memory Testing
- **Baseline Monitoring**: Track memory before operations
- **Peak Detection**: Monitor maximum memory usage
- **Leak Detection**: Verify memory cleanup after requests
- **Streaming Efficiency**: Test memory usage during streaming

## Expected Performance Targets

### Response Times
- **Single Ticker**: < 1 second
- **5 Tickers**: < 2 seconds
- **10 Tickers**: < 3 seconds
- **20 Tickers**: < 5 seconds

### Memory Usage
- **Baseline**: < 100MB
- **Peak Usage**: < 400MB (80% of Vercel limit)
- **Memory Growth**: < 50MB per request
- **Streaming**: < 100MB for large datasets

### Vercel Compliance
- **Timeout**: All requests complete within 10 seconds
- **Memory**: Stay within 512MB limit
- **Cold Start**: < 1 second initialization
- **Success Rate**: > 95% for normal operations

## Test Reports

### Generated Reports
1. **`async_performance_report.json`**: Detailed performance metrics
2. **`async_performance_report.md`**: Human-readable performance report
3. **`async_performance_benchmark.png`**: Performance visualization charts
4. **`async_test_report.json`**: Comprehensive test results
5. **`htmlcov_async/index.html`**: Code coverage report

### Report Contents
- **Performance Metrics**: Response times, throughput, memory usage
- **Success Rates**: Test pass/fail rates by category
- **Recommendations**: Performance optimization suggestions
- **Vercel Compliance**: Platform-specific compliance metrics
- **Trend Analysis**: Performance changes over time

## Continuous Integration

### CI Pipeline Integration
```yaml
# Example GitHub Actions workflow
- name: Run Async Tests
  run: |
    cd api
    python run_async_tests.py --type all --no-coverage
    
- name: Performance Benchmarks
  run: |
    cd api
    python async_performance_benchmark.py
    
- name: Upload Reports
  uses: actions/upload-artifact@v3
  with:
    name: async-test-reports
    path: |
      api/async_performance_report.json
      api/async_performance_report.md
      api/async_performance_benchmark.png
```

## Local Development

### Prerequisites
```bash
# Install test dependencies
pip install -r requirements.txt

# Start local server
uvicorn main:app --reload --port 8000

# Verify server is running
curl http://localhost:8000/health
```

### Test Development
1. Add new test methods to appropriate test classes
2. Use provided fixtures for common operations
3. Follow async/await patterns for all async operations
4. Add performance monitoring for new endpoints
5. Include Vercel compliance checks

### Mock Testing
Use the `mock_external_api` fixture for:
- Testing without external API dependencies
- Consistent test data
- Faster test execution
- Rate limit avoidance

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```bash
   # Start the server first
   uvicorn main:app --reload --port 8000
   ```

2. **Timeout Errors**
   ```bash
   # Increase timeout in test configuration
   TEST_TIMEOUT=60 python run_async_tests.py
   ```

3. **Memory Issues**
   ```bash
   # Monitor memory usage
   python -c "import psutil; print(f'Available memory: {psutil.virtual_memory().available / 1024 / 1024:.0f}MB')"
   ```

4. **Dependency Issues**
   ```bash
   # Reinstall dependencies
   pip install -r requirements.txt --force-reinstall
   ```

### Performance Issues
- Check database connection pooling
- Verify async/await usage
- Monitor memory leaks
- Test with different ticker counts
- Validate caching mechanisms

## Best Practices

### Test Writing
1. Use descriptive test names
2. Follow AAA pattern (Arrange, Act, Assert)
3. Include performance assertions
4. Test both success and failure cases
5. Use appropriate fixtures

### Performance Testing
1. Test with realistic data volumes
2. Monitor memory usage continuously
3. Test concurrent scenarios
4. Validate timeout handling
5. Include cold start testing

### Vercel Compliance
1. Always test within platform limits
2. Monitor function execution time
3. Test memory efficiency
4. Validate response streaming
5. Check edge function compatibility

## Monitoring and Alerting

### Production Monitoring
- Response time percentiles (P95, P99)
- Memory usage patterns
- Error rates by endpoint
- Concurrent request handling
- Database connection pool health

### Alert Thresholds
- Response time > 5 seconds
- Memory usage > 400MB
- Error rate > 1%
- Timeout rate > 0.1%
- Success rate < 99%

This testing suite ensures the async implementation meets performance requirements while maintaining compatibility with Vercel's serverless environment.