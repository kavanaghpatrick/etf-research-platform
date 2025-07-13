"""Yahoo Finance data source implementation."""

import time
import random
import logging
from typing import Union, Dict
from datetime import datetime
import pandas as pd

from .base import DataSource
from ...utils import Config, retry_with_backoff


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
            # Set cache location only if not already set
            try:
                yf.set_tz_cache_location("/tmp/.cache/yfinance")
            except AssertionError:
                # Cache already initialized, ignore
                pass
        except ImportError:
            self.yf = None
            self.logger.warning("yfinance not installed")
    
    @property
    def name(self) -> str:
        return "YahooFinance"
    
    @property
    def priority(self) -> int:
        return 1  # Highest priority
    
    @property
    def supports_batch(self) -> bool:
        return True
    
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
        jitter = random.uniform(0.5, 1.5)
        time.sleep(jitter)
        
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
                auto_adjust=False,  # Get both Close and Adj Close
                actions=False,      # Don't include dividends/splits
                prepost=False,
                repair=True         # Attempt to fix missing data
            )
            
            if data.empty:
                raise ValueError(f"No data returned for {ticker}")
            
            # Ensure we have all required columns
            required_columns = ['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']
            for col in required_columns:
                if col not in data.columns:
                    if col == 'Adj Close' and 'Close' in data.columns:
                        data['Adj Close'] = data['Close']
                    else:
                        data[col] = 0
            
            return data[required_columns]
            
        except Exception as e:
            self.logger.error(f"YFinance error for {ticker}: {str(e)}")
            raise
    
    def fetch_batch(
        self,
        tickers: list[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> Dict[str, pd.DataFrame]:
        """Fetch data for multiple tickers in a batch."""
        if not self.is_available():
            raise RuntimeError("YFinance source not available")
        
        self._apply_rate_limit()
        
        try:
            # YFinance supports batch download
            tickers_str = " ".join(tickers)
            data = self.yf.download(
                tickers=tickers_str,
                start=start_date,
                end=end_date,
                auto_adjust=False,
                actions=False,
                prepost=False,
                repair=True,
                group_by='ticker',
                threads=True
            )
            
            results = {}
            
            # Handle single ticker case
            if len(tickers) == 1:
                if not data.empty:
                    results[tickers[0]] = data
                else:
                    results[tickers[0]] = pd.DataFrame()
            else:
                # Multiple tickers - data is multi-indexed
                for ticker in tickers:
                    try:
                        ticker_data = data[ticker]
                        if not ticker_data.empty and not ticker_data.isna().all().all():
                            results[ticker] = ticker_data
                        else:
                            results[ticker] = pd.DataFrame()
                    except KeyError:
                        results[ticker] = pd.DataFrame()
            
            return results
            
        except Exception as e:
            self.logger.error(f"YFinance batch error: {str(e)}")
            # Fall back to individual fetching
            return super().fetch_batch(tickers, start_date, end_date)