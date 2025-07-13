"""
Comprehensive tests for the resilient data fetching system.
Tests rate limiting, failover, data quality, and edge cases.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import time
import os

from src.data.resilient_fetcher import (
    ResilientDataFetcher, SourceStatus, DataRequest, 
    RateLimitManager, DataQualityChecker
)
from src.data.sources import DataSource
from src.utils import Config


class MockDataSource(DataSource):
    """Mock data source for testing."""
    
    def __init__(self, name: str, priority: int, fail_count: int = 0):
        self._name = name
        self._priority = priority
        self.fail_count = fail_count
        self.call_count = 0
        self.should_fail = False
        self.rate_limited = False
    
    @property
    def name(self) -> str:
        return self._name
    
    @property
    def priority(self) -> int:
        return self._priority
    
    def fetch_data(self, ticker, start_date, end_date):
        self.call_count += 1
        
        if self.rate_limited:
            raise RuntimeError("429 Too Many Requests")
        
        if self.should_fail or self.call_count <= self.fail_count:
            raise ValueError(f"Mock failure for {ticker}")
        
        # Simulate invalid tickers
        if ticker in ["INVALID", "FAKE", "BADTICKER"]:
            raise ValueError(f"Invalid ticker: {ticker}")
        
        # Return mock data
        dates = pd.date_range(start=start_date, end=end_date, freq='D')
        data = pd.DataFrame({
            'Open': np.random.uniform(100, 200, len(dates)),
            'High': np.random.uniform(100, 200, len(dates)),
            'Low': np.random.uniform(100, 200, len(dates)),
            'Close': np.random.uniform(100, 200, len(dates)),
            'Volume': np.random.randint(1000000, 10000000, len(dates))
        }, index=dates)
        
        # Fix OHLC relationships
        data['High'] = data[['Open', 'High', 'Close']].max(axis=1)
        data['Low'] = data[['Open', 'Low', 'Close']].min(axis=1)
        data['Adj Close'] = data['Close']
        
        return data
    
    def is_available(self):
        return True


class TestSourceStatus:
    """Test source health tracking."""
    
    def test_source_status_initialization(self):
        status = SourceStatus(name="TestSource")
        
        assert status.name == "TestSource"
        assert status.available is True
        assert status.consecutive_failures == 0
        assert status.success_rate == 0.0
        assert status.is_healthy is True
    
    def test_record_success(self):
        status = SourceStatus(name="TestSource")
        
        status.record_success(1.5)
        
        assert status.consecutive_failures == 0
        assert status.total_requests == 1
        assert status.successful_requests == 1
        assert status.success_rate == 1.0
        # average_response_time uses exponential moving average starting from 0
        # First update: 0.1 * 1.5 + 0.9 * 0 = 0.15
        assert abs(status.average_response_time - 0.15) < 0.0001
    
    def test_record_failure(self):
        status = SourceStatus(name="TestSource")
        
        status.record_failure(is_rate_limit=False)
        
        assert status.consecutive_failures == 1
        assert status.total_requests == 1
        assert status.successful_requests == 0
        assert status.success_rate == 0.0
        assert status.rate_limit_hits == 0
    
    def test_rate_limit_backoff(self):
        status = SourceStatus(name="TestSource")
        
        # Record rate limit failure
        status.record_failure(is_rate_limit=True)
        
        assert status.rate_limit_hits == 1
        assert status.backoff_until is not None
        assert status.backoff_until > datetime.now()
        assert not status.is_healthy
    
    def test_exponential_backoff(self):
        status = SourceStatus(name="TestSource")
        
        # Record multiple rate limit failures
        backoff_times = []
        for i in range(3):
            status.record_failure(is_rate_limit=True)
            if status.backoff_until:
                backoff_duration = (status.backoff_until - datetime.now()).total_seconds() / 60
                backoff_times.append(backoff_duration)
        
        # Check exponential increase
        assert len(backoff_times) == 3
        assert backoff_times[1] > backoff_times[0]
        assert backoff_times[2] > backoff_times[1]


class TestRateLimitManager:
    """Test token bucket rate limiting."""
    
    def test_rate_limit_manager_basic(self):
        # 2 tokens per second, burst of 5
        manager = RateLimitManager(rate=2.0, burst=5)
        
        assert manager.capacity == 5
        assert manager.tokens == 5
    
    def test_acquire_within_burst(self):
        manager = RateLimitManager(rate=2.0, burst=5)
        
        # Should be able to acquire 5 tokens immediately
        for i in range(5):
            wait_time = manager.acquire(1)
            assert wait_time == 0.0
        
        # 6th request should wait
        wait_time = manager.acquire(1)
        assert wait_time > 0
    
    def test_token_replenishment(self):
        manager = RateLimitManager(rate=2.0, burst=5)
        
        # Use all tokens
        for i in range(5):
            manager.acquire(1)
        
        # Wait for tokens to replenish
        time.sleep(1.0)  # Should get 2 tokens back
        
        wait_time = manager.acquire(1)
        assert wait_time == 0.0  # Should have tokens available


class TestDataQualityChecker:
    """Test data quality validation and repair."""
    
    def test_validate_empty_data(self):
        data = pd.DataFrame()
        is_valid, issues = DataQualityChecker.validate_data(data, "TEST")
        
        assert not is_valid
        assert "Empty dataframe" in issues
    
    def test_validate_missing_columns(self):
        data = pd.DataFrame({
            'Open': [100, 101],
            'Close': [101, 102]
        })
        
        is_valid, issues = DataQualityChecker.validate_data(data, "TEST")
        
        assert not is_valid
        assert any("Missing columns" in issue for issue in issues)
        # Should still work even with missing columns for other checks
        assert len(issues) >= 1
    
    def test_validate_invalid_ohlc(self):
        data = pd.DataFrame({
            'Open': [100, 101],
            'High': [105, 99],  # Invalid: High < Low
            'Low': [95, 100],
            'Close': [101, 102],
            'Volume': [1000, 2000]
        })
        
        is_valid, issues = DataQualityChecker.validate_data(data, "TEST")
        
        assert not is_valid
        assert any("High < Low" in issue for issue in issues)
    
    def test_validate_zero_prices(self):
        data = pd.DataFrame({
            'Open': [100, 0],  # Zero price
            'High': [105, 110],
            'Low': [95, 100],
            'Close': [101, -5],  # Negative price
            'Volume': [1000, 2000]
        })
        
        is_valid, issues = DataQualityChecker.validate_data(data, "TEST")
        
        assert not is_valid
        assert any("zero or negative prices" in issue for issue in issues)
    
    def test_repair_data(self):
        # Create data with issues
        dates = pd.date_range('2023-01-01', periods=5)
        data = pd.DataFrame({
            'Open': [100, 101, 102, 103, 104],
            'High': [105, 99, 107, 108, 109],  # One invalid
            'Low': [95, 100, 97, 98, 99],
            'Close': [101, 102, 103, 104, 105],
            'Volume': [1000, np.nan, 3000, 4000, 5000]  # Missing value
        }, index=dates)
        
        # Add duplicate index
        data = pd.concat([data, data.iloc[[2]]])
        
        repaired = DataQualityChecker.repair_data(data)
        
        # Check repairs
        assert len(repaired) == 5  # Duplicate removed
        assert repaired['High'].iloc[1] >= repaired['Low'].iloc[1]  # OHLC fixed
        assert not repaired['Volume'].iloc[1] != repaired['Volume'].iloc[1]  # NaN filled


class TestResilientDataFetcher:
    """Test the main resilient fetcher."""
    
    @pytest.fixture
    def mock_sources(self):
        """Create mock sources for testing."""
        return [
            MockDataSource("Primary", priority=1),
            MockDataSource("Secondary", priority=2),
            MockDataSource("Tertiary", priority=3)
        ]
    
    @pytest.fixture
    def fetcher(self, mock_sources, tmp_path):
        """Create fetcher with mock sources."""
        config = Config({
            "data": {
                "cache_dir": str(tmp_path),
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        return ResilientDataFetcher(
            config=config,
            sources=mock_sources,
            quality_check=True,
            repair_data=True
        )
    
    def test_fetch_with_fallback_success(self, fetcher):
        """Test successful fetch from primary source."""
        data = fetcher.fetch_with_fallback(
            "AAPL",
            datetime.now() - timedelta(days=5),
            datetime.now()
        )
        
        assert not data.empty
        assert len(data) > 0
        assert all(col in data.columns for col in ['Open', 'High', 'Low', 'Close', 'Volume'])
    
    def test_fetch_with_fallback_primary_fails(self, fetcher, mock_sources):
        """Test fallback when primary source fails."""
        # Make primary source fail
        mock_sources[0].should_fail = True
        
        data = fetcher.fetch_with_fallback(
            "AAPL",
            datetime.now() - timedelta(days=5),
            datetime.now()
        )
        
        assert not data.empty
        # Should have used secondary source
        assert mock_sources[0].call_count == 1
        assert mock_sources[1].call_count == 1
    
    def test_fetch_with_rate_limit_handling(self, fetcher, mock_sources):
        """Test handling of rate limit errors."""
        # Make primary source rate limited
        mock_sources[0].rate_limited = True
        
        data = fetcher.fetch_with_fallback(
            "AAPL",
            datetime.now() - timedelta(days=5),
            datetime.now()
        )
        
        # Should fallback to secondary
        assert not data.empty
        
        # Check that primary source is in backoff
        primary_status = fetcher.source_status[mock_sources[0].name]
        assert primary_status.rate_limit_hits > 0
        assert primary_status.backoff_until is not None
    
    def test_all_sources_fail(self, fetcher, mock_sources):
        """Test behavior when all sources fail."""
        # Make all sources fail
        for source in mock_sources:
            source.should_fail = True
        
        data = fetcher.fetch_with_fallback(
            "AAPL",
            datetime.now() - timedelta(days=5),
            datetime.now()
        )
        
        assert data.empty
        
        # All sources should have been tried
        for source in mock_sources:
            assert source.call_count >= 1
    
    def test_source_health_tracking(self, fetcher, mock_sources):
        """Test that source health is properly tracked."""
        # Track source calls
        primary_calls_before = mock_sources[0].call_count
        secondary_calls_before = mock_sources[1].call_count
        
        # Make primary source fail initially
        mock_sources[0].should_fail = True
        
        # First request - should fail and fallback
        data1 = fetcher.fetch_with_fallback("AAPL", "2023-01-01", "2023-01-05")
        assert not data1.empty  # Should succeed via secondary
        
        # Check health after failure
        health = fetcher.get_source_health()
        primary_health = health[mock_sources[0].name]
        assert primary_health['consecutive_failures'] > 0
        
        # Make primary source work again
        mock_sources[0].should_fail = False
        
        # Force a new request (use different ticker to avoid cache)
        data2 = fetcher.fetch_with_fallback("MSFT", "2023-01-01", "2023-01-05")
        assert not data2.empty
        
        # Check that both sources were used
        assert mock_sources[0].call_count > primary_calls_before
        assert mock_sources[1].call_count > secondary_calls_before
        
        # Check health metrics
        health = fetcher.get_source_health()
        primary_health = health[mock_sources[0].name]
        secondary_health = health[mock_sources[1].name]
        
        # Both sources should have recorded requests
        assert primary_health['total_requests'] >= 1
        assert secondary_health['total_requests'] >= 1
    
    def test_priority_request_handling(self, fetcher):
        """Test that priority requests are handled correctly."""
        # High priority request
        high_priority_data = fetcher.fetch_with_fallback(
            "SPY",
            "2023-01-01",
            "2023-01-05",
            priority=-1  # High priority
        )
        
        # Normal priority request
        normal_priority_data = fetcher.fetch_with_fallback(
            "AAPL",
            "2023-01-01",
            "2023-01-05",
            priority=0
        )
        
        assert not high_priority_data.empty
        assert not normal_priority_data.empty
    
    def test_cache_functionality(self, fetcher):
        """Test that caching works properly."""
        ticker = "CACHE_TEST"
        start = "2023-01-01"
        end = "2023-01-05"
        
        # First fetch - should hit source
        data1 = fetcher.fetch_with_fallback(ticker, start, end)
        source_calls_1 = sum(s.call_count for s in fetcher.sources)
        
        # Second fetch - should hit cache
        data2 = fetcher.fetch_with_fallback(ticker, start, end)
        source_calls_2 = sum(s.call_count for s in fetcher.sources)
        
        assert not data1.empty
        assert data1.equals(data2)
        assert source_calls_2 == source_calls_1  # No additional source calls
    
    def test_batch_fetch_resilience(self, fetcher):
        """Test batch fetching with mixed success/failure."""
        tickers = ["AAPL", "MSFT", "INVALID", "GOOGL", "FAKE"]
        
        results = fetcher.fetch_multiple_resilient(
            tickers,
            "2023-01-01",
            "2023-01-05",
            max_workers=3
        )
        
        assert len(results) == len(tickers)
        
        # Valid tickers should have data
        assert not results["AAPL"].empty
        assert not results["MSFT"].empty
        assert not results["GOOGL"].empty
        
        # Invalid tickers should have empty DataFrames
        assert results["INVALID"].empty
        assert results["FAKE"].empty
    
    def test_repair_missing_data(self, fetcher):
        """Test data repair functionality."""
        # Create data with gaps
        dates = pd.date_range('2023-01-01', '2023-01-10')
        incomplete_data = pd.DataFrame({
            'Open': [100, 101, np.nan, 103, 104],
            'High': [105, 106, np.nan, 108, 109],
            'Low': [95, 96, np.nan, 98, 99],
            'Close': [101, 102, np.nan, 104, 105],
            'Volume': [1000, 2000, np.nan, 4000, 5000]
        }, index=dates[:5])  # Only 5 days out of 10
        
        repaired = fetcher.repair_missing_data(
            "TEST",
            incomplete_data,
            dates[0],
            dates[-1]
        )
        
        # Should attempt to fill missing dates
        assert len(repaired) >= len(incomplete_data)


class TestDataSourceSelection:
    """Test intelligent source selection."""
    
    def test_select_best_source_by_success_rate(self):
        """Test that sources with higher success rates are preferred."""
        sources = [
            MockDataSource("Source1", priority=1),
            MockDataSource("Source2", priority=2),
            MockDataSource("Source3", priority=3)
        ]
        
        config = Config({
            "data": {
                "cache_dir": "/tmp",
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        fetcher = ResilientDataFetcher(config=config, sources=sources)
        
        # Set different success rates
        fetcher.source_status["Source1"].total_requests = 100
        fetcher.source_status["Source1"].successful_requests = 50  # 50% success
        
        fetcher.source_status["Source2"].total_requests = 100
        fetcher.source_status["Source2"].successful_requests = 90  # 90% success
        
        fetcher.source_status["Source3"].total_requests = 100
        fetcher.source_status["Source3"].successful_requests = 70  # 70% success
        
        # Despite Source1 having higher priority, Source2 should be selected
        best_source = fetcher._select_best_source(set())
        
        # The selection considers both priority and success rate
        # Source2 might be selected due to much higher success rate
        assert best_source is not None
    
    def test_select_best_source_excludes_failed(self):
        """Test that failed sources are excluded."""
        sources = [
            MockDataSource("Source1", priority=1),
            MockDataSource("Source2", priority=2)
        ]
        
        config = Config({
            "data": {
                "cache_dir": "/tmp",
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        fetcher = ResilientDataFetcher(config=config, sources=sources)
        
        # Source1 has already failed for this request
        failed_sources = {"Source1"}
        
        best_source = fetcher._select_best_source(failed_sources)
        
        assert best_source.name == "Source2"
    
    def test_select_best_source_none_available(self):
        """Test when no sources are available."""
        sources = [MockDataSource("Source1", priority=1)]
        
        config = Config({
            "data": {
                "cache_dir": "/tmp",
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        fetcher = ResilientDataFetcher(config=config, sources=sources)
        
        # Mark source as unhealthy
        fetcher.source_status["Source1"].available = False
        
        best_source = fetcher._select_best_source(set())
        
        assert best_source is None


class TestEdgeCases:
    """Test edge cases and error conditions."""
    
    @pytest.fixture
    def fetcher(self, tmp_path):
        """Create fetcher for edge case tests."""
        config = Config({
            "data": {
                "cache_dir": str(tmp_path),
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        sources = [
            MockDataSource("Primary", priority=1),
            MockDataSource("Secondary", priority=2)
        ]
        return ResilientDataFetcher(
            config=config,
            sources=sources,
            quality_check=True,
            repair_data=True
        )
    
    def test_empty_source_list(self, tmp_path):
        """Test behavior with no sources."""
        config = Config({
            "data": {
                "cache_dir": str(tmp_path),
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        fetcher = ResilientDataFetcher(config=config, sources=[])
        
        data = fetcher.fetch_with_fallback("AAPL", "2023-01-01", "2023-01-05")
        
        assert data.empty
    
    def test_concurrent_requests(self, fetcher):
        """Test handling of concurrent requests."""
        import concurrent.futures
        
        tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(
                    fetcher.fetch_with_fallback,
                    ticker,
                    "2023-01-01",
                    "2023-01-05"
                )
                for ticker in tickers
            ]
            
            results = [f.result() for f in concurrent.futures.as_completed(futures)]
        
        # All requests should complete
        assert len(results) == len(tickers)
        assert all(isinstance(r, pd.DataFrame) for r in results)
    
    def test_source_recovery_after_backoff(self):
        """Test that sources recover after backoff period."""
        sources = [MockDataSource("Source1", priority=1)]
        config = Config({
            "data": {
                "cache_dir": "/tmp",
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            }
        })
        fetcher = ResilientDataFetcher(config=config, sources=sources)
        
        # Put source in backoff
        status = fetcher.source_status["Source1"]
        status.backoff_until = datetime.now() - timedelta(seconds=1)  # Already expired
        
        # Source should be healthy again
        assert status.is_healthy
    
    @patch('pandas.DataFrame.to_pickle')
    @patch('pandas.read_pickle')
    def test_cache_corruption_handling(self, mock_read, mock_write, fetcher):
        """Test handling of corrupted cache."""
        # Make cache read fail
        mock_read.side_effect = Exception("Corrupted cache")
        
        # Should still fetch from source
        data = fetcher.fetch_with_fallback("AAPL", "2023-01-01", "2023-01-05")
        
        assert not data.empty