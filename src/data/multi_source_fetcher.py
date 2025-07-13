"""
Multi-source data fetcher with fallback, caching, and rate limiting.
Implements best practices for durable financial data fetching.
"""

import time
import random
import logging
from typing import Dict, List, Optional, Union, Any, Callable
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
import pandas as pd
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from functools import wraps

from ..utils import Config, load_config, retry_with_backoff
from .cache import DataCache


class DataSource(ABC):
    """Abstract base class for data sources."""
    
    @abstractmethod
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch data from this source."""
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this data source is currently available."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the data source."""
        pass
    
    @property
    @abstractmethod
    def priority(self) -> int:
        """Priority of this source (lower is higher priority)."""
        pass


class YFinanceSource(DataSource):
    """Yahoo Finance data source using yfinance."""
    
    def __init__(self, config: Config):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self._last_request_time = 0
        self._request_count = 0
        self._rate_limit_window = 60  # 1 minute window
        self._max_requests_per_window = 30  # Conservative limit
        
        try:
            import yfinance as yf
            self.yf = yf
        except ImportError:
            self.yf = None
            self.logger.warning("yfinance not installed")
    
    @property
    def name(self) -> str:
        return "YahooFinance"
    
    @property
    def priority(self) -> int:
        return 1  # Highest priority
    
    def is_available(self) -> bool:
        """Check if yfinance is available and not rate limited."""
        if self.yf is None:
            return False
        
        # Check rate limiting
        current_time = time.time()
        if current_time - self._last_request_time > self._rate_limit_window:
            self._request_count = 0
            
        return self._request_count < self._max_requests_per_window
    
    def _apply_rate_limit(self):
        """Apply rate limiting logic."""
        current_time = time.time()
        
        # Reset counter if window has passed
        if current_time - self._last_request_time > self._rate_limit_window:
            self._request_count = 0
        
        # If we're at the limit, wait
        if self._request_count >= self._max_requests_per_window:
            sleep_time = self._rate_limit_window - (current_time - self._last_request_time)
            if sleep_time > 0:
                self.logger.info(f"Rate limit reached, sleeping for {sleep_time:.1f}s")
                time.sleep(sleep_time + 1)  # Add 1 second buffer
                self._request_count = 0
        
        # Add jitter to avoid thundering herd
        time.sleep(random.uniform(0.5, 1.5))
        
        self._request_count += 1
        self._last_request_time = current_time
    
    @retry_with_backoff(max_attempts=3, exceptions=(Exception,))
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch data from Yahoo Finance with rate limiting."""
        if not self.is_available():
            raise RuntimeError("YFinance source not available")
        
        self._apply_rate_limit()
        
        try:
            stock = self.yf.Ticker(ticker)
            data = stock.history(
                start=start_date,
                end=end_date,
                auto_adjust=True,
                prepost=False
            )
            
            if data.empty:
                raise ValueError(f"No data returned for {ticker}")
            
            return data
            
        except Exception as e:
            self.logger.error(f"YFinance error for {ticker}: {str(e)}")
            raise


class AlphaVantageSource(DataSource):
    """Alpha Vantage data source."""
    
    def __init__(self, config: Config, api_key: Optional[str] = None):
        self.config = config
        self.api_key = api_key or os.environ.get("ALPHA_VANTAGE_API_KEY")
        self.logger = logging.getLogger(__name__)
        self._last_request_time = 0
        self._rate_limit_delay = 12  # 5 calls per minute for free tier
    
    @property
    def name(self) -> str:
        return "AlphaVantage"
    
    @property
    def priority(self) -> int:
        return 2
    
    def is_available(self) -> bool:
        return self.api_key is not None
    
    def _apply_rate_limit(self):
        """Apply rate limiting for Alpha Vantage (5 calls/minute for free)."""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        
        if elapsed < self._rate_limit_delay:
            sleep_time = self._rate_limit_delay - elapsed
            self.logger.debug(f"Rate limiting: sleeping for {sleep_time:.1f}s")
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
    
    @retry_with_backoff(max_attempts=3, exceptions=(Exception,))
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch data from Alpha Vantage."""
        if not self.is_available():
            raise RuntimeError("Alpha Vantage API key not configured")
        
        self._apply_rate_limit()
        
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": ticker,
            "apikey": self.api_key,
            "outputsize": "full",
            "datatype": "json"
        }
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        if "Error Message" in data:
            raise ValueError(f"API error: {data['Error Message']}")
        
        if "Note" in data:  # Rate limit message
            raise RuntimeError(f"Rate limit: {data['Note']}")
        
        if "Time Series (Daily)" not in data:
            raise ValueError("No time series data in response")
        
        # Convert to DataFrame
        ts_data = data["Time Series (Daily)"]
        df = pd.DataFrame.from_dict(ts_data, orient="index")
        df.index = pd.to_datetime(df.index)
        
        # Rename columns to match yfinance format
        df = df.rename(columns={
            "1. open": "Open",
            "2. high": "High",
            "3. low": "Low",
            "4. close": "Close",
            "5. adjusted close": "Adj Close",
            "6. volume": "Volume"
        })
        
        # Convert to numeric
        for col in df.columns:
            df[col] = pd.to_numeric(df[col])
        
        # Filter by date range
        df = df.sort_index()
        if isinstance(start_date, str):
            start_date = pd.to_datetime(start_date)
        if isinstance(end_date, str):
            end_date = pd.to_datetime(end_date)
        
        mask = (df.index >= start_date) & (df.index <= end_date)
        return df.loc[mask]


class MultiSourceDataFetcher:
    """
    Fetches data from multiple sources with fallback, caching, and rate limiting.
    
    Best practices implemented:
    1. Multiple data sources with priority-based fallback
    2. Intelligent caching with TTL
    3. Rate limiting per source
    4. Concurrent fetching with thread pooling
    5. Comprehensive error handling and logging
    6. Request batching where supported
    """
    
    def __init__(
        self,
        cache: Optional[DataCache] = None,
        config: Optional[Config] = None,
        sources: Optional[List[DataSource]] = None
    ):
        self.config = config or load_config()
        self.cache = cache or DataCache(self.config.data.cache_dir)
        self.logger = logging.getLogger(__name__)
        
        # Initialize data sources
        if sources is None:
            self.sources = self._initialize_default_sources()
        else:
            self.sources = sorted(sources, key=lambda x: x.priority)
    
    def _initialize_default_sources(self) -> List[DataSource]:
        """Initialize default data sources."""
        sources = []
        
        # Add YFinance
        sources.append(YFinanceSource(self.config))
        
        # Add Alpha Vantage if API key is available
        if os.environ.get("ALPHA_VANTAGE_API_KEY"):
            sources.append(AlphaVantageSource(self.config))
        
        # Sort by priority
        return sorted(sources, key=lambda x: x.priority)
    
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        force_refresh: bool = False
    ) -> pd.DataFrame:
        """
        Fetch data with fallback across multiple sources.
        
        Args:
            ticker: Stock/ETF ticker symbol
            start_date: Start date for data
            end_date: End date for data (default: today)
            force_refresh: Force refresh from source, ignore cache
            
        Returns:
            DataFrame with price data
        """
        if end_date is None:
            end_date = datetime.now()
        
        # Check cache first (unless force refresh)
        if not force_refresh:
            cache_key = f"multi_source_{ticker}_{start_date}_{end_date}"
            cached_data = self.cache.get(cache_key)
            
            if cached_data is not None:
                self.logger.debug(f"Cache hit for {ticker}")
                return cached_data
        
        # Try each source in priority order
        errors = []
        
        for source in self.sources:
            if not source.is_available():
                self.logger.debug(f"Source {source.name} not available")
                continue
            
            try:
                self.logger.info(f"Fetching {ticker} from {source.name}")
                data = source.fetch_data(ticker, start_date, end_date)
                
                if not data.empty:
                    # Cache the successful result
                    if not force_refresh:
                        self.cache.set(cache_key, data, ttl_hours=self.config.data.cache_ttl_hours)
                    
                    self.logger.info(f"Successfully fetched {ticker} from {source.name}")
                    return data
                    
            except Exception as e:
                error_msg = f"{source.name} failed for {ticker}: {str(e)}"
                self.logger.warning(error_msg)
                errors.append(error_msg)
        
        # All sources failed
        error_summary = "\n".join(errors)
        raise RuntimeError(f"All data sources failed for {ticker}:\n{error_summary}")
    
    def fetch_multiple(
        self,
        tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        max_workers: Optional[int] = None,
        force_refresh: bool = False
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch data for multiple tickers concurrently.
        
        Uses intelligent batching and concurrent execution while
        respecting rate limits.
        """
        if max_workers is None:
            max_workers = min(self.config.data.max_workers, len(tickers))
        
        results = {}
        failed = {}
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all tasks
            future_to_ticker = {
                executor.submit(
                    self.fetch_data,
                    ticker,
                    start_date,
                    end_date,
                    force_refresh
                ): ticker
                for ticker in tickers
            }
            
            # Collect results
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                
                try:
                    data = future.result()
                    results[ticker] = data
                    
                except Exception as e:
                    self.logger.error(f"Failed to fetch {ticker}: {str(e)}")
                    failed[ticker] = str(e)
                    results[ticker] = pd.DataFrame()  # Empty DataFrame
        
        # Log summary
        success_count = sum(1 for df in results.values() if not df.empty)
        self.logger.info(
            f"Fetched {success_count}/{len(tickers)} tickers successfully. "
            f"Failed: {list(failed.keys())}"
        )
        
        return results
    
    def get_available_sources(self) -> List[str]:
        """Get list of currently available data sources."""
        return [
            source.name 
            for source in self.sources 
            if source.is_available()
        ]
    
    def add_source(self, source: DataSource):
        """Add a new data source."""
        self.sources.append(source)
        self.sources.sort(key=lambda x: x.priority)
        self.logger.info(f"Added data source: {source.name}")
    
    def remove_source(self, source_name: str):
        """Remove a data source by name."""
        self.sources = [s for s in self.sources if s.name != source_name]
        self.logger.info(f"Removed data source: {source_name}")


import os