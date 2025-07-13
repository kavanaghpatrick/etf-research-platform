"""Tiingo data source implementation."""

import os
import time
import logging
from typing import Union, Optional
from datetime import datetime
import pandas as pd
import requests

from .base import DataSource
from ...utils import Config, retry_with_backoff


class TiingoSource(DataSource):
    """Tiingo data source."""
    
    def __init__(self, config: Config, api_key: Optional[str] = None):
        self.config = config
        self.api_key = api_key or os.environ.get("TIINGO_API_KEY")
        self.logger = logging.getLogger(__name__)
        self._last_request_time = 0
        
        # Free tier: Generous limits, but we'll be conservative
        self._rate_limit_delay = 0.1  # 10 requests per second
        self._base_url = "https://api.tiingo.com/tiingo/daily"
    
    @property
    def name(self) -> str:
        return "Tiingo"
    
    @property
    def priority(self) -> int:
        return 4  # Fourth priority
    
    def is_available(self) -> bool:
        """Check if API key is configured."""
        return self.api_key is not None
    
    def _apply_rate_limit(self):
        """Apply rate limiting for Tiingo."""
        current_time = time.time()
        elapsed = current_time - self._last_request_time
        
        if elapsed < self._rate_limit_delay:
            sleep_time = self._rate_limit_delay - elapsed
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
    
    @retry_with_backoff(max_attempts=3, exceptions=(requests.RequestException,))
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch data from Tiingo."""
        if not self.is_available():
            raise RuntimeError("Tiingo not available (no API key)")
        
        self._apply_rate_limit()
        
        # Format dates
        if isinstance(start_date, datetime):
            start_date = start_date.strftime("%Y-%m-%d")
        if isinstance(end_date, datetime):
            end_date = end_date.strftime("%Y-%m-%d")
        
        # Tiingo requires lowercase tickers
        ticker = ticker.lower()
        
        url = f"{self._base_url}/{ticker}/prices"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Token {self.api_key}"
        }
        
        params = {
            "startDate": start_date,
            "endDate": end_date,
            "format": "json",
            "resampleFreq": "daily"
        }
        
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        # Check for common errors
        if response.status_code == 404:
            raise ValueError(f"Ticker {ticker} not found")
        elif response.status_code == 401:
            raise RuntimeError("Invalid API key")
        elif response.status_code == 429:
            raise RuntimeError("Rate limit exceeded")
        
        response.raise_for_status()
        
        data = response.json()
        
        if not data:
            raise ValueError(f"No data returned for {ticker}")
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Parse date and set as index
        df["date"] = pd.to_datetime(df["date"])
        df.set_index("date", inplace=True)
        
        # Rename columns to match standard format
        column_mapping = {
            "open": "Open",
            "high": "High",
            "low": "Low",
            "close": "Close",
            "adjClose": "Adj Close",
            "volume": "Volume",
            "adjOpen": "Adj Open",
            "adjHigh": "Adj High",
            "adjLow": "Adj Low",
            "adjVolume": "Adj Volume"
        }
        
        df = df.rename(columns=column_mapping)
        
        # Select standard columns
        standard_columns = ["Open", "High", "Low", "Close", "Adj Close", "Volume"]
        available_columns = [col for col in standard_columns if col in df.columns]
        df = df[available_columns]
        
        # Ensure all required columns exist
        for col in standard_columns:
            if col not in df.columns:
                if col == "Adj Close" and "Close" in df.columns:
                    df["Adj Close"] = df["Close"]
                else:
                    df[col] = 0
        
        return df[standard_columns]