"""Alpha Vantage data source implementation."""

import os
import time
import logging
from typing import Union, Optional
from datetime import datetime
import pandas as pd
import requests

from .base import DataSource
from ...utils import Config, retry_with_backoff


class AlphaVantageSource(DataSource):
    """Alpha Vantage data source."""
    
    def __init__(self, config: Config, api_key: Optional[str] = None):
        self.config = config
        self.api_key = api_key or os.environ.get("ALPHA_VANTAGE_API_KEY")
        self.logger = logging.getLogger(__name__)
        self._last_request_time = 0
        
        # Rate limits by tier
        if self.api_key:
            # Assume free tier by default (5 calls/minute, 500 calls/day)
            self._rate_limit_delay = 12.5  # Slightly more than 12s to be safe
            self._daily_limit = 500
            self._daily_count = 0
            self._daily_reset_time = time.time()
    
    @property
    def name(self) -> str:
        return "AlphaVantage"
    
    @property
    def priority(self) -> int:
        return 2  # Second priority after YFinance
    
    def is_available(self) -> bool:
        """Check if API key is configured and daily limit not exceeded."""
        if not self.api_key:
            return False
        
        # Reset daily counter if a day has passed
        current_time = time.time()
        if current_time - self._daily_reset_time > 86400:  # 24 hours
            self._daily_count = 0
            self._daily_reset_time = current_time
        
        return self._daily_count < self._daily_limit
    
    def _apply_rate_limit(self):
        """Apply rate limiting for Alpha Vantage."""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        
        if elapsed < self._rate_limit_delay:
            sleep_time = self._rate_limit_delay - elapsed
            self.logger.debug(f"Rate limiting: sleeping for {sleep_time:.1f}s")
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
        self._daily_count += 1
    
    @retry_with_backoff(max_attempts=3, exceptions=(requests.RequestException,))
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch data from Alpha Vantage."""
        if not self.is_available():
            raise RuntimeError("Alpha Vantage not available (no API key or limit exceeded)")
        
        self._apply_rate_limit()
        
        # Determine if we need full output based on date range
        if isinstance(start_date, str):
            start_date = pd.to_datetime(start_date)
        
        days_back = (datetime.now() - start_date).days
        outputsize = "full" if days_back > 100 else "compact"
        
        url = "https://www.alphavantage.co/query"
        params = {
            "function": "TIME_SERIES_DAILY_ADJUSTED",
            "symbol": ticker,
            "apikey": self.api_key,
            "outputsize": outputsize,
            "datatype": "json"
        }
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for errors
        if "Error Message" in data:
            raise ValueError(f"API error: {data['Error Message']}")
        
        if "Note" in data:  # Rate limit message
            self.logger.warning(f"Rate limit warning: {data['Note']}")
            # Mark as unavailable temporarily
            self._daily_count = self._daily_limit
            raise RuntimeError(f"Rate limit: {data['Note']}")
        
        if "Information" in data:  # Premium data message
            raise ValueError(f"API info: {data['Information']}")
        
        if "Time Series (Daily)" not in data:
            raise ValueError("No time series data in response")
        
        # Convert to DataFrame
        ts_data = data["Time Series (Daily)"]
        df = pd.DataFrame.from_dict(ts_data, orient="index")
        df.index = pd.to_datetime(df.index)
        
        # Rename columns to match standard format
        column_mapping = {
            "1. open": "Open",
            "2. high": "High",
            "3. low": "Low",
            "4. close": "Close",
            "5. adjusted close": "Adj Close",
            "6. volume": "Volume",
            "7. dividend amount": "Dividend",
            "8. split coefficient": "Split"
        }
        
        df = df.rename(columns=column_mapping)
        
        # Keep only price columns
        price_columns = ["Open", "High", "Low", "Close", "Adj Close", "Volume"]
        df = df[[col for col in price_columns if col in df.columns]]
        
        # Convert to numeric
        for col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Sort by date and filter range
        df = df.sort_index()
        
        if isinstance(end_date, str):
            end_date = pd.to_datetime(end_date)
        
        mask = (df.index >= start_date) & (df.index <= end_date)
        df = df.loc[mask]
        
        # Ensure all required columns exist
        for col in price_columns:
            if col not in df.columns:
                if col == 'Adj Close' and 'Close' in df.columns:
                    df['Adj Close'] = df['Close']
                else:
                    df[col] = 0
        
        return df[price_columns]