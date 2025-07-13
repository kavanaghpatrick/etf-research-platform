"""
Integration tests for the resilient data fetching system.
Tests the complete flow with multiple sources and real-world scenarios.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import time
import os

from src.data import ResilientDataFetcher, DataAggregator
from src.data.sources import YFinanceSource, AlphaVantageSource
from src.utils import Config, load_config


class TestIntegrationResilientFetching:
    """Integration tests for resilient data fetching."""
    
    @pytest.fixture
    def config(self, tmp_path):
        """Create test configuration."""
        return Config({
            "data": {
                "cache_dir": str(tmp_path / "cache"),
                "cache_ttl_hours": 24,
                "max_workers": 3,
                "rate_limit_delay": 0.1,
                "retry_attempts": 3,
                "retry_delay": 0.5
            },
            "analytics": {
                "risk_free_rate": 0.02,
                "periods_per_year": 252
            }
        })
    
    @pytest.mark.integration
    def test_full_pipeline_with_fallback(self, config):
        """Test the full data fetching pipeline with source fallback."""
        # Create fetcher with mocked sources
        fetcher = ResilientDataFetcher(config=config)
        
        # Mock YFinance to fail initially
        with patch.object(YFinanceSource, 'fetch_data') as mock_yf:
            mock_yf.side_effect = [
                RuntimeError("429 Too Many Requests"),  # First attempt fails
                RuntimeError("Connection timeout"),      # Second attempt fails
                pd.DataFrame({  # Third attempt succeeds
                    'Open': [100, 101, 102],
                    'High': [105, 106, 107],
                    'Low': [95, 96, 97],
                    'Close': [102, 103, 104],
                    'Adj Close': [102, 103, 104],
                    'Volume': [1000000, 1100000, 1200000]
                }, index=pd.date_range('2023-01-01', periods=3))
            ]
            
            # Fetch data
            data = fetcher.fetch_with_fallback(
                "AAPL",
                "2023-01-01",
                "2023-01-03"
            )
            
            assert not data.empty
            assert len(data) == 3
            
            # Check that YFinance was called multiple times due to retries
            assert mock_yf.call_count >= 2
    
    @pytest.mark.integration
    def test_multi_source_aggregation_real_scenario(self, config):
        """Test aggregation with realistic multi-source data."""
        aggregator = DataAggregator(config=config)
        
        # Create realistic mock data from different sources
        dates = pd.date_range('2023-01-01', '2023-01-10', freq='D')
        
        # YFinance data - most complete
        yf_data = pd.DataFrame({
            'Open': [100 + i + np.random.normal(0, 0.1) for i in range(len(dates))],
            'High': [105 + i + np.random.normal(0, 0.1) for i in range(len(dates))],
            'Low': [95 + i + np.random.normal(0, 0.1) for i in range(len(dates))],
            'Close': [102 + i + np.random.normal(0, 0.1) for i in range(len(dates))],
            'Volume': [1000000 + i * 10000 + np.random.randint(-5000, 5000) for i in range(len(dates))],
            '_source': 'YahooFinance',
            '_source_priority': 1
        }, index=dates)
        yf_data['Adj Close'] = yf_data['Close'] * 0.99  # Slight adjustment
        
        # Alpha Vantage - missing weekends
        av_dates = [d for d in dates if d.weekday() < 5]  # Weekdays only
        av_data = pd.DataFrame({
            'Open': [100 + dates.get_loc(d) for d in av_dates],
            'High': [105 + dates.get_loc(d) for d in av_dates],
            'Low': [95 + dates.get_loc(d) for d in av_dates],
            'Close': [102 + dates.get_loc(d) for d in av_dates],
            'Volume': [1000000 + dates.get_loc(d) * 10000 for d in av_dates],
            '_source': 'AlphaVantage',
            '_source_priority': 2
        }, index=av_dates)
        av_data['Adj Close'] = av_data['Close']
        
        # Mock the fetching
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = {
                'YahooFinance': yf_data,
                'AlphaVantage': av_data
            }
            
            # Test different aggregation methods
            for method in ['best_quality', 'average', 'consensus', 'priority']:
                result = aggregator.aggregate_from_all_sources(
                    "AAPL",
                    "2023-01-01",
                    "2023-01-10",
                    aggregation_method=method
                )
                
                assert not result.empty
                assert len(result) >= len(av_dates)  # At least weekday data
                
                # Verify OHLC relationships
                assert (result['High'] >= result['Low']).all()
                assert (result['High'] >= result['Open']).all()
                assert (result['High'] >= result['Close']).all()
    
    @pytest.mark.integration
    def test_concurrent_batch_fetching_with_failures(self, config):
        """Test batch fetching with concurrent requests and partial failures."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Mock source to simulate realistic behavior
        call_count = 0
        
        def mock_fetch(ticker, start, end):
            nonlocal call_count
            call_count += 1
            
            # Simulate different behaviors for different tickers
            if ticker == "FAIL_ALWAYS":
                raise ValueError("Invalid ticker")
            elif ticker == "FAIL_ONCE" and call_count == 1:
                raise RuntimeError("Temporary failure")
            elif ticker == "RATE_LIMITED" and call_count < 3:
                raise RuntimeError("429 Too Many Requests")
            else:
                # Return mock data
                dates = pd.date_range(start, end, freq='D')
                return pd.DataFrame({
                    'Open': np.random.uniform(100, 110, len(dates)),
                    'High': np.random.uniform(110, 120, len(dates)),
                    'Low': np.random.uniform(90, 100, len(dates)),
                    'Close': np.random.uniform(100, 110, len(dates)),
                    'Adj Close': np.random.uniform(100, 110, len(dates)),
                    'Volume': np.random.randint(1000000, 2000000, len(dates))
                }, index=dates)
        
        # Patch the primary source
        with patch.object(fetcher.sources[0], 'fetch_data', side_effect=mock_fetch):
            tickers = [
                "AAPL", "MSFT", "GOOGL",  # Should succeed
                "FAIL_ALWAYS",            # Always fails
                "FAIL_ONCE",              # Fails once then succeeds
                "RATE_LIMITED"            # Rate limited initially
            ]
            
            results = fetcher.fetch_multiple_resilient(
                tickers,
                datetime.now() - timedelta(days=5),
                datetime.now(),
                max_workers=3
            )
            
            # Check results
            assert len(results) == len(tickers)
            
            # Successful tickers
            for ticker in ["AAPL", "MSFT", "GOOGL"]:
                assert not results[ticker].empty
            
            # Always failing ticker
            assert results["FAIL_ALWAYS"].empty
            
            # Eventually successful tickers
            assert not results["FAIL_ONCE"].empty  # Should succeed on retry
            assert not results["RATE_LIMITED"].empty  # Should succeed after backoff
    
    @pytest.mark.integration
    def test_source_health_persistence(self, config):
        """Test that source health is persisted across instances."""
        # First fetcher instance
        fetcher1 = ResilientDataFetcher(config=config)
        
        # Simulate some activity
        source_name = fetcher1.sources[0].name if fetcher1.sources else "TestSource"
        if source_name in fetcher1.source_status:
            status = fetcher1.source_status[source_name]
            status.record_success(1.5)
            status.record_success(1.2)
            status.record_failure()
            status.record_failure(is_rate_limit=True)
        
        # Save health
        fetcher1._save_source_health()
        
        # Create new fetcher instance
        fetcher2 = ResilientDataFetcher(config=config)
        
        # Check that health was loaded
        if source_name in fetcher2.source_status:
            loaded_status = fetcher2.source_status[source_name]
            assert loaded_status.total_requests > 0
            assert loaded_status.successful_requests > 0
            assert loaded_status.rate_limit_hits > 0
    
    @pytest.mark.integration
    @pytest.mark.slow
    def test_rate_limiting_behavior(self, config):
        """Test rate limiting behavior under load."""
        fetcher = ResilientDataFetcher(config=config)
        
        if not fetcher.sources:
            pytest.skip("No sources available")
        
        # Get the rate limiter for the primary source
        primary_source = fetcher.sources[0]
        rate_limiter = fetcher.rate_limiters[primary_source.name]
        
        # Track timing
        request_times = []
        
        # Make rapid requests
        for i in range(10):
            start_time = time.time()
            rate_limiter.acquire()
            elapsed = time.time() - start_time
            request_times.append(elapsed)
        
        # First few should be fast (within burst)
        burst_size = rate_limiter.capacity
        assert all(t < 0.1 for t in request_times[:burst_size])
        
        # Later requests should be rate limited
        assert any(t > 0.1 for t in request_times[burst_size:])
    
    @pytest.mark.integration
    def test_data_repair_with_multiple_sources(self, config):
        """Test data repair by combining multiple incomplete sources."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Create incomplete data
        dates = pd.date_range('2023-01-01', '2023-01-10', freq='D')
        incomplete_data = pd.DataFrame({
            'Open': [100, 101, np.nan, 103, np.nan, 105, 106, np.nan, 108, 109],
            'High': [105, 106, np.nan, 108, np.nan, 110, 111, np.nan, 113, 114],
            'Low': [95, 96, np.nan, 98, np.nan, 100, 101, np.nan, 103, 104],
            'Close': [102, 103, np.nan, 105, np.nan, 107, 108, np.nan, 110, 111],
            'Volume': [1e6, 1.1e6, np.nan, 1.3e6, np.nan, 1.5e6, 1.6e6, np.nan, 1.8e6, 1.9e6]
        }, index=dates)
        incomplete_data['Adj Close'] = incomplete_data['Close']
        
        # Mock sources to return data for missing dates
        def mock_fetch(ticker, start, end):
            # Return data only for the missing dates
            if start.date() == dates[2].date():  # First gap
                return pd.DataFrame({
                    'Open': [102], 'High': [107], 'Low': [97],
                    'Close': [104], 'Volume': [1.2e6], 'Adj Close': [104]
                }, index=[dates[2]])
            elif start.date() == dates[4].date():  # Second gap
                return pd.DataFrame({
                    'Open': [104], 'High': [109], 'Low': [99],
                    'Close': [106], 'Volume': [1.4e6], 'Adj Close': [106]
                }, index=[dates[4]])
            else:
                return pd.DataFrame()  # No data for other ranges
        
        with patch.object(fetcher.sources[0], 'fetch_data', side_effect=mock_fetch):
            repaired = fetcher.repair_missing_data(
                "TEST",
                incomplete_data,
                dates[0],
                dates[-1]
            )
            
            # Check that gaps were filled
            assert repaired['Open'].isna().sum() < incomplete_data['Open'].isna().sum()
            assert not repaired.iloc[2].isna().any()  # First gap filled
            assert not repaired.iloc[4].isna().any()  # Second gap filled
    
    @pytest.mark.integration
    def test_edge_case_all_sources_down(self, config):
        """Test behavior when all sources are unavailable."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Mark all sources as unhealthy
        for source_name in fetcher.source_status:
            status = fetcher.source_status[source_name]
            status.available = False
        
        # Try to fetch data
        data = fetcher.fetch_with_fallback("AAPL", "2023-01-01", "2023-01-05")
        
        assert data.empty
        
        # Check that appropriate error was logged
        # In real implementation, we'd check log messages
    
    @pytest.mark.integration
    def test_cache_hit_performance(self, config):
        """Test that cache hits are fast."""
        fetcher = ResilientDataFetcher(config=config)
        
        # Mock source to track calls
        mock_source = Mock()
        mock_source.name = "TestSource"
        mock_source.priority = 1
        mock_source.is_available.return_value = True
        mock_source.fetch_data.return_value = pd.DataFrame({
            'Open': [100], 'High': [105], 'Low': [95],
            'Close': [102], 'Volume': [1000000], 'Adj Close': [102]
        }, index=pd.date_range('2023-01-01', periods=1))
        
        fetcher.sources = [mock_source]
        fetcher.source_status = {mock_source.name: SourceStatus(mock_source.name)}
        
        # First fetch - should hit source
        start_time = time.time()
        data1 = fetcher.fetch_with_fallback("CACHE_TEST", "2023-01-01", "2023-01-01")
        first_fetch_time = time.time() - start_time
        
        assert mock_source.fetch_data.call_count == 1
        
        # Second fetch - should hit cache
        start_time = time.time()
        data2 = fetcher.fetch_with_fallback("CACHE_TEST", "2023-01-01", "2023-01-01")
        cache_fetch_time = time.time() - start_time
        
        assert mock_source.fetch_data.call_count == 1  # No additional calls
        assert cache_fetch_time < first_fetch_time * 0.1  # Cache should be much faster
        assert data1.equals(data2)


from src.data.resilient_fetcher import SourceStatus