import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import pickle
from pathlib import Path

from src.data import ETFDataFetcher, DataCache


class TestETFDataFetcher:
    @patch('src.data.fetcher.yf.Ticker')
    def test_fetch_etf_data(self, mock_ticker_class):
        # Mock yfinance response
        mock_ticker = Mock()
        mock_history = pd.DataFrame({
            'Open': [100, 101, 102],
            'High': [101, 102, 103],
            'Low': [99, 100, 101],
            'Close': [100.5, 101.5, 102.5],
            'Volume': [1000000, 1100000, 1200000]
        }, index=pd.date_range('2022-01-01', periods=3))
        
        mock_ticker.history.return_value = mock_history
        mock_ticker_class.return_value = mock_ticker
        
        fetcher = ETFDataFetcher()
        data = fetcher.fetch_etf_data("SPY", "2022-01-01", "2022-01-03")
        
        assert isinstance(data, pd.DataFrame)
        assert len(data) == 3
        assert 'Close' in data.columns
        mock_ticker.history.assert_called_once()
    
    @patch('src.data.fetcher.yf.Ticker')
    def test_fetch_etf_data_empty(self, mock_ticker_class):
        # Mock empty response
        mock_ticker = Mock()
        mock_ticker.history.return_value = pd.DataFrame()
        mock_ticker_class.return_value = mock_ticker
        
        fetcher = ETFDataFetcher()
        data = fetcher.fetch_etf_data("INVALID", "2022-01-01", "2022-01-03")
        
        assert isinstance(data, pd.DataFrame)
        assert data.empty
    
    @patch('src.data.fetcher.yf.Ticker')
    def test_fetch_etf_data_error(self, mock_ticker_class):
        # Mock exception
        mock_ticker = Mock()
        mock_ticker.history.side_effect = Exception("API Error")
        mock_ticker_class.return_value = mock_ticker
        
        fetcher = ETFDataFetcher()
        data = fetcher.fetch_etf_data("SPY", "2022-01-01", "2022-01-03")
        
        assert isinstance(data, pd.DataFrame)
        assert data.empty
    
    @patch('src.data.fetcher.yf.Ticker')
    def test_fetch_multiple_etfs(self, mock_ticker_class, sample_price_data):
        # Mock different responses for each ticker
        def create_mock_ticker(ticker):
            mock = Mock()
            if ticker in sample_price_data:
                mock.history.return_value = sample_price_data[ticker]
            else:
                mock.history.return_value = pd.DataFrame()
            return mock
        
        mock_ticker_class.side_effect = create_mock_ticker
        
        fetcher = ETFDataFetcher()
        results = fetcher.fetch_multiple_etfs(
            ["SPY", "AGG", "INVALID"],
            "2022-01-01",
            "2022-12-31",
            max_workers=2
        )
        
        assert len(results) == 3
        assert "SPY" in results
        assert "AGG" in results
        assert "INVALID" in results
        assert not results["SPY"].empty
        assert not results["AGG"].empty
        assert results["INVALID"].empty
    
    @patch('src.data.fetcher.yf.Ticker')
    def test_get_etf_info(self, mock_ticker_class):
        mock_ticker = Mock()
        mock_ticker.info = {
            "longName": "SPDR S&P 500 ETF Trust",
            "annualReportExpenseRatio": 0.0009,
            "totalAssets": 400000000000,
            "category": "Large Blend",
            "fundFamily": "SPDR",
            "yield": 0.015,
            "beta3Year": 1.0
        }
        mock_ticker_class.return_value = mock_ticker
        
        fetcher = ETFDataFetcher()
        info = fetcher.get_etf_info("SPY")
        
        assert info["ticker"] == "SPY"
        assert info["name"] == "SPDR S&P 500 ETF Trust"
        assert info["expense_ratio"] == 0.0009
        assert info["total_assets"] == 400000000000
    
    @patch('src.data.fetcher.yf.Ticker')
    def test_create_etf_object(self, mock_ticker_class, sample_price_data):
        mock_ticker = Mock()
        mock_ticker.info = {
            "longName": "SPDR S&P 500 ETF Trust",
            "annualReportExpenseRatio": 0.0009,
            "category": "Large Blend",
            "fundFamily": "SPDR"
        }
        mock_ticker.history.return_value = sample_price_data["SPY"]
        mock_ticker_class.return_value = mock_ticker
        
        fetcher = ETFDataFetcher()
        etf = fetcher.create_etf_object("SPY", "2022-01-01", "2022-12-31")
        
        assert etf is not None
        assert etf.ticker == "SPY"
        assert etf.name == "SPDR S&P 500 ETF Trust"
        assert etf.expense_ratio == 0.0009
        assert etf.has_price_data
    
    def test_get_sector_etfs(self):
        fetcher = ETFDataFetcher()
        sectors = fetcher.get_sector_etfs()
        
        assert isinstance(sectors, dict)
        assert "Technology" in sectors
        assert "Healthcare" in sectors
        assert isinstance(sectors["Technology"], list)
        assert "XLK" in sectors["Technology"]
    
    def test_get_popular_etfs(self):
        fetcher = ETFDataFetcher()
        etfs = fetcher.get_popular_etfs()
        
        assert isinstance(etfs, list)
        assert len(etfs) > 10
        assert "SPY" in etfs
        assert "QQQ" in etfs
        assert "AGG" in etfs


class TestDataCache:
    def test_cache_init(self, tmp_path):
        cache_dir = tmp_path / "cache"
        cache = DataCache(str(cache_dir))
        
        assert cache.cache_dir.exists()
        assert cache.cache_dir == cache_dir
    
    def test_set_and_get(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        test_data = {"value": 42, "list": [1, 2, 3]}
        cache.set("test_key", test_data, ttl_hours=24)
        
        retrieved = cache.get("test_key")
        assert retrieved == test_data
    
    def test_get_nonexistent(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        result = cache.get("nonexistent_key")
        assert result is None
    
    def test_cache_expiration(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        # Set with very short TTL
        test_data = {"value": 42}
        cache.set("test_key", test_data, ttl_hours=0)
        
        # Manually modify the timestamp to simulate expiration
        cache_path = cache._get_cache_path("test_key")
        with open(cache_path, "rb") as f:
            cache_data = pickle.load(f)
        
        cache_data["timestamp"] = datetime.now() - timedelta(hours=1)
        
        with open(cache_path, "wb") as f:
            pickle.dump(cache_data, f)
        
        # Should return None due to expiration
        result = cache.get("test_key")
        assert result is None
        assert not cache_path.exists()  # File should be deleted
    
    def test_invalidate(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        cache.set("test_key", {"value": 42})
        assert cache.get("test_key") is not None
        
        cache.invalidate("test_key")
        assert cache.get("test_key") is None
    
    def test_clear(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        # Set multiple items
        cache.set("key1", {"value": 1})
        cache.set("key2", {"value": 2})
        cache.set("key3", {"value": 3})
        
        # Clear all
        cache.clear()
        
        assert cache.get("key1") is None
        assert cache.get("key2") is None
        assert cache.get("key3") is None
    
    def test_get_cache_info(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        # Set some items
        cache.set("key1", {"value": 1}, ttl_hours=24)
        cache.set("key2", {"value": 2}, ttl_hours=48)
        
        info = cache.get_cache_info()
        
        assert info["total_items"] == 2
        assert info["total_size_mb"] > 0
        assert len(info["items"]) == 2
        
        for item in info["items"]:
            assert "key" in item
            assert "size_mb" in item
            assert "age_hours" in item
            assert "ttl_remaining_hours" in item
    
    def test_safe_key_generation(self, tmp_path):
        cache = DataCache(str(tmp_path / "cache"))
        
        # Test with problematic characters
        test_key = "path/with/slashes\\and\\backslashes"
        cache.set(test_key, {"value": 42})
        
        # Should still be retrievable
        result = cache.get(test_key)
        assert result == {"value": 42}
        
        # Check that the file was created with safe name
        cache_files = list(cache.cache_dir.glob("*.pkl"))
        assert len(cache_files) == 1
        assert "/" not in cache_files[0].name
        assert "\\" not in cache_files[0].name