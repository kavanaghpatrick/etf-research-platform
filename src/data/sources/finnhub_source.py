"""Finnhub data source implementation."""

import os
import time
import logging
from typing import Union, Optional
from datetime import datetime, timedelta
import pandas as pd
import requests

from .base import DataSource
from ...utils import Config, retry_with_backoff


class FinnhubSource(DataSource):
    """Finnhub.io data source."""
    
    def __init__(self, config: Config, api_key: Optional[str] = None):
        self.config = config
        self.api_key = api_key or os.environ.get("FINNHUB_API_KEY")
        self.logger = logging.getLogger(__name__)
        self._last_request_time = 0
        
        # Free tier: 60 calls/minute
        self._rate_limit_delay = 1.1  # Slightly over 1 second
        self._base_url = "https://finnhub.io/api/v1"
    
    @property
    def name(self) -> str:
        return "Finnhub"
    
    @property
    def priority(self) -> int:
        return 3  # Third priority
    
    def is_available(self) -> bool:
        """Check if API key is configured."""
        return self.api_key is not None
    
    def _apply_rate_limit(self):
        """Apply rate limiting for Finnhub."""
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
        """Fetch data from Finnhub."""
        if not self.is_available():
            raise RuntimeError("Finnhub not available (no API key)")
        
        self._apply_rate_limit()
        
        # Convert dates to timestamps
        if isinstance(start_date, str):
            start_date = pd.to_datetime(start_date)
        if isinstance(end_date, str):
            end_date = pd.to_datetime(end_date)
        
        start_ts = int(start_date.timestamp())
        end_ts = int(end_date.timestamp())
        
        # Finnhub uses different resolutions based on date range
        days_diff = (end_date - start_date).days
        
        if days_diff <= 1:
            resolution = "1"  # 1 minute
        elif days_diff <= 7:
            resolution = "5"  # 5 minutes
        elif days_diff <= 30:
            resolution = "60"  # 1 hour
        else:
            resolution = "D"  # Daily
        
        url = f"{self._base_url}/stock/candle"
        params = {
            "symbol": ticker,
            "resolution": resolution,
            "from": start_ts,
            "to": end_ts,
            "token": self.api_key
        }
        
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Check for errors
        if data.get("s") == "no_data":
            raise ValueError(f"No data available for {ticker}")
        
        if "error" in data:
            raise ValueError(f"API error: {data['error']}")
        
        if not all(key in data for key in ["t", "o", "h", "l", "c", "v"]):
            raise ValueError("Incomplete data in response")
        
        # Convert to DataFrame
        df = pd.DataFrame({
            "timestamp": data["t"],
            "Open": data["o"],
            "High": data["h"],
            "Low": data["l"],
            "Close": data["c"],
            "Volume": data["v"]
        })
        
        # Convert timestamp to datetime
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="s")
        df.set_index("timestamp", inplace=True)
        
        # Add Adj Close (Finnhub doesn't provide adjusted close)
        df["Adj Close"] = df["Close"]
        
        # Resample to daily if we got intraday data
        if resolution != "D" and len(df) > 0:
            df_daily = df.resample("D").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
                "Adj Close": "last"
            }).dropna()
            df = df_daily
        
        # Ensure columns are in correct order
        return df[["Open", "High", "Low", "Close", "Adj Close", "Volume"]]