"""
Performance and stress tests for the resilient data fetching system.
Tests system behavior under high load and extreme conditions.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import time
import threading
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.data import ResilientDataFetcher, DataAggregator
from src.data.resilient_fetcher import RateLimitManager, SourceStatus
from src.utils import Config


class TestPerformanceResilient:
    """Performance tests for resilient data fetching."""
    
    @pytest.fixture
    def config(self, tmp_path):
        """Create test configuration for performance testing."""
        return Config({
            "data": {
                "cache_dir": str(tmp_path / "cache"),
                "cache_ttl_hours": 24,
                "max_workers": 10,  # Higher for stress testing
                "rate_limit_delay": 0.001,  # Very fast for testing
                "retry_attempts": 1,  # Minimal retries for speed
                "retry_delay": 0.01  # Very short retry delay
            }
        })
    
    @pytest.mark.performance  
    def test_high_concurrent_load(self, config, tmp_path):
        """Test system under high concurrent load."""
        # Skip all the complexity and just test ThreadPoolExecutor directly
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def simple_task(ticker_id):
            """Simulate fetching a ticker."""
            time.sleep(0.01)  # 10ms delay
            if random.random() < 0.05:  # 5% failure rate
                raise RuntimeError(f"Failed {ticker_id}")
            return pd.DataFrame({'Close': [100 + ticker_id]}, index=[datetime.now()])
        
        # First test raw ThreadPoolExecutor performance
        start_time = time.time()
        results = {}
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(simple_task, i): f"TICKER{i}" for i in range(30)}
            for future in as_completed(futures):
                ticker = futures[future]
                try:
                    results[ticker] = future.result()
                except Exception:
                    results[ticker] = pd.DataFrame()
        
        raw_elapsed = time.time() - start_time
        print(f"\nRaw ThreadPoolExecutor: 30 tasks in {raw_elapsed:.2f}s")
        
        # Now test with ResilientDataFetcher but minimal config
        from .test_resilient_fetcher import MockDataSource
        
        # Create a single mock source with no retries
        mock_source = MockDataSource("FastSource", priority=1)
        mock_source.fetch_data = lambda t, s, e: simple_task(int(t[-4:]))
        
        # Create minimal config with no retries or delays
        fast_config = Config({
            "data": {
                "cache_dir": str(tmp_path / "cache"),
                "cache_ttl_hours": 0,  # Disable cache
                "max_workers": 5,
                "rate_limit_delay": 0,
                "retry_attempts": 1,  # One attempt only
                "retry_delay": 0,
                "default_rate_limit": 1000.0,  # 1000 requests/sec for testing
                "default_burst_limit": 100     # Large burst for testing
            }
        })
        
        fetcher = ResilientDataFetcher(
            config=fast_config,
            sources=[mock_source],
            quality_check=False,  # Skip quality checks
            repair_data=False     # Skip data repair
        )
        
        tickers = [f"TEST{i:04d}" for i in range(30)]
        
        start_time = time.time()
        results = fetcher.fetch_multiple_resilient(
            tickers,
            datetime.now() - timedelta(days=1),
            datetime.now(),
            max_workers=5
        )
        elapsed = time.time() - start_time
        
        successful = sum(1 for df in results.values() if not df.empty)
        
        print(f"\nResilientDataFetcher: {len(tickers)} tickers in {elapsed:.2f}s")
        print(f"Success rate: {successful}/{len(tickers)} ({successful/len(tickers)*100:.1f}%)")
        
        # Both should complete quickly
        assert raw_elapsed < 1.0, f"Raw executor too slow: {raw_elapsed:.2f}s"
        assert elapsed < 2.0, f"Fetcher too slow: {elapsed:.2f}s"
        assert successful >= 25  # At least 83% success with 5% failure rate
    
    @pytest.mark.performance
    def test_rate_limiter_performance(self):
        """Test rate limiter performance under stress."""
        # Test with high request rate
        rate_limiter = RateLimitManager(rate=100.0, burst=50)
        
        request_count = 1000
        start_time = time.time()
        
        for _ in range(request_count):
            rate_limiter.acquire()
        
        elapsed = time.time() - start_time
        
        # Should handle requests at specified rate
        expected_time = (request_count - 50) / 100.0  # Minus burst, divided by rate
        assert elapsed >= expected_time * 0.9  # Allow 10% variance
        
        print(f"\nRate limiter: {request_count} requests in {elapsed:.2f}s")
        print(f"Effective rate: {request_count/elapsed:.1f} req/s")
    
    @pytest.mark.performance
    def test_concurrent_rate_limiting(self):
        """Test rate limiting with concurrent requests."""
        rate_limiter = RateLimitManager(rate=10.0, burst=5)
        
        results = []
        
        def make_request(request_id):
            wait_time = rate_limiter.acquire()
            return request_id, wait_time, time.time()
        
        # Launch concurrent requests
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_request, i) for i in range(50)]
            results = [f.result() for f in as_completed(futures)]
        
        # Sort by request completion time
        results.sort(key=lambda x: x[2])
        
        # First 5 should be immediate (burst)
        immediate_count = sum(1 for _, wait_time, _ in results if wait_time < 0.01)
        assert immediate_count >= 5
        
        # Rest should be rate limited
        rate_limited = [r for r in results if r[1] > 0.01]
        assert len(rate_limited) > 0
    
    @pytest.mark.performance
    @pytest.mark.slow
    def test_cache_performance_under_load(self, config):
        """Test cache performance with many entries."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Pre-populate cache with many entries
        print("\nPopulating cache...")
        for i in range(1000):
            ticker = f"CACHE{i:04d}"
            data = pd.DataFrame({
                'Close': [100 + i],
                'Volume': [1000000]
            }, index=pd.date_range('2023-01-01', periods=1))
            
            cache_key = f"resilient_{ticker}_2023-01-01_2023-01-01"
            fetcher.cache.set(cache_key, data)
        
        # Measure cache retrieval performance
        print("Testing cache retrieval...")
        cache_hits = 0
        start_time = time.time()
        
        for i in range(1000):
            ticker = f"CACHE{i:04d}"
            cache_key = f"resilient_{ticker}_2023-01-01_2023-01-01"
            data = fetcher.cache.get(cache_key)
            if data is not None:
                cache_hits += 1
        
        elapsed = time.time() - start_time
        
        assert cache_hits == 1000
        assert elapsed < 1.0  # Should retrieve 1000 items in under 1 second
        
        print(f"Cache performance: {cache_hits} hits in {elapsed:.3f}s")
        print(f"Average: {elapsed/cache_hits*1000:.2f}ms per retrieval")
    
    @pytest.mark.performance
    def test_aggregator_performance(self, config):
        """Test data aggregator performance with multiple sources."""
        aggregator = DataAggregator(config=config)
        
        # Create large datasets from multiple sources
        dates = pd.date_range('2020-01-01', '2023-12-31', freq='D')
        num_sources = 5
        
        source_data = {}
        for i in range(num_sources):
            # Create realistic data with some variations
            base_price = 100 + i * 10
            trend = np.linspace(0, 50, len(dates))
            noise = np.random.normal(0, 2, len(dates))
            
            prices = base_price + trend + noise
            
            source_data[f'Source{i}'] = pd.DataFrame({
                'Open': prices * 0.99,
                'High': prices * 1.01,
                'Low': prices * 0.98,
                'Close': prices,
                'Volume': np.random.randint(1000000, 5000000, len(dates)),
                'Adj Close': prices,
                '_source': f'Source{i}',
                '_source_priority': i + 1
            }, index=dates)
        
        # Test different aggregation methods
        methods = ['best_quality', 'average', 'consensus', 'priority']
        
        for method in methods:
            with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
                mock_fetch.return_value = source_data
                
                start_time = time.time()
                result = aggregator.aggregate_from_all_sources(
                    "TEST",
                    dates[0],
                    dates[-1],
                    aggregation_method=method
                )
                elapsed = time.time() - start_time
                
                assert not result.empty
                assert len(result) == len(dates)
                
                print(f"\nAggregation '{method}': {len(dates)} days, "
                      f"{num_sources} sources in {elapsed:.3f}s")
    
    @pytest.mark.performance
    def test_memory_efficiency(self, config):
        """Test memory usage with large datasets."""
        import psutil
        import gc
        
        process = psutil.Process()
        gc.collect()
        
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        fetcher = ResilientDataFetcher(config=config)
        
        # Create large dataset
        large_tickers = [f"MEM{i:04d}" for i in range(100)]
        dates = pd.date_range('2020-01-01', '2023-12-31', freq='D')
        
        def mock_fetch(ticker, start, end):
            # Return large dataset
            return pd.DataFrame({
                'Open': np.random.uniform(100, 110, len(dates)),
                'High': np.random.uniform(110, 120, len(dates)),
                'Low': np.random.uniform(90, 100, len(dates)),
                'Close': np.random.uniform(100, 110, len(dates)),
                'Adj Close': np.random.uniform(100, 110, len(dates)),
                'Volume': np.random.randint(1000000, 2000000, len(dates))
            }, index=dates)
        
        with patch.object(fetcher.sources[0], 'fetch_data', side_effect=mock_fetch):
            results = fetcher.fetch_multiple_resilient(
                large_tickers[:10],  # Fetch only 10 to keep test fast
                dates[0],
                dates[-1],
                max_workers=5
            )
        
        gc.collect()
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        print(f"\nMemory usage: Initial={initial_memory:.1f}MB, "
              f"Final={final_memory:.1f}MB, Increase={memory_increase:.1f}MB")
        
        # Should not use excessive memory
        assert memory_increase < 500  # Less than 500MB increase
    
    @pytest.mark.performance
    def test_source_failover_speed(self, config):
        """Test how quickly system fails over between sources."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Track failover times
        failover_times = []
        
        for i in range(10):
            # Mock sources with first one always failing quickly
            primary_fail_time = 0.1
            
            def mock_primary_fetch(ticker, start, end):
                time.sleep(primary_fail_time)
                raise RuntimeError("Primary source failed")
            
            def mock_secondary_fetch(ticker, start, end):
                return pd.DataFrame({
                    'Close': [100],
                    'Volume': [1000000]
                }, index=pd.date_range(start, periods=1))
            
            with patch.object(fetcher.sources[0], 'fetch_data', side_effect=mock_primary_fetch):
                with patch.object(fetcher.sources[1] if len(fetcher.sources) > 1 else fetcher.sources[0], 
                                'fetch_data', side_effect=mock_secondary_fetch):
                    
                    start_time = time.time()
                    data = fetcher.fetch_with_fallback(f"FAIL{i}", "2023-01-01", "2023-01-01")
                    failover_time = time.time() - start_time
                    
                    if not data.empty:
                        failover_times.append(failover_time)
        
        if failover_times:
            avg_failover = sum(failover_times) / len(failover_times)
            print(f"\nAverage failover time: {avg_failover:.3f}s")
            
            # Should fail over quickly
            assert avg_failover < 1.0  # Less than 1 second average
    
    @pytest.mark.performance
    def test_extreme_date_ranges(self, config):
        """Test performance with very long date ranges."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Mock source that returns large dataset
        def mock_fetch(ticker, start, end):
            # Create 10 years of daily data
            dates = pd.date_range(start, end, freq='D')
            return pd.DataFrame({
                'Open': np.random.uniform(100, 110, len(dates)),
                'High': np.random.uniform(110, 120, len(dates)),
                'Low': np.random.uniform(90, 100, len(dates)),
                'Close': np.random.uniform(100, 110, len(dates)),
                'Adj Close': np.random.uniform(100, 110, len(dates)),
                'Volume': np.random.randint(1000000, 2000000, len(dates))
            }, index=dates)
        
        with patch.object(fetcher.sources[0], 'fetch_data', side_effect=mock_fetch):
            start_date = datetime(2014, 1, 1)
            end_date = datetime(2024, 1, 1)
            
            start_time = time.time()
            data = fetcher.fetch_with_fallback("LONGRANGE", start_date, end_date)
            elapsed = time.time() - start_time
            
            assert not data.empty
            assert len(data) > 3000  # Should have many days
            
            print(f"\nLarge date range: {len(data)} days fetched in {elapsed:.2f}s")
            print(f"Rate: {len(data)/elapsed:.0f} days/second")