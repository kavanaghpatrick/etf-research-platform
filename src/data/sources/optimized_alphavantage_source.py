"""
Optimized AlphaVantage source for free tier usage.
Uses only free endpoints with proper rate limiting.
"""

import time
import requests
import pandas as pd
import logging
from typing import Union, Dict
from datetime import datetime
import json

from .base import DataSource
from ...utils import Config, retry_with_backoff


class OptimizedAlphaVantageSource(DataSource):
    """Optimized AlphaVantage source for free tier (25 calls/day)."""
    
    def __init__(self, config=None, api_key=None):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.api_key = api_key or self._get_api_key()
        self.base_url = "https://www.alphavantage.co/query"
        self._request_count = 0
        self._daily_limit = 25
        self._last_request_time = 0
        self._min_interval = 12  # 12 seconds between requests (5 requests/minute max)
        
    def _get_api_key(self) -> str:
        """Get API key from environment or config."""
        import os
        api_key = os.environ.get('ALPHA_VANTAGE_API_KEY')
        if not api_key and self.config:
            api_key = getattr(self.config.data, 'alphavantage_api_key', None)
        return api_key or ""
    
    @property
    def name(self) -> str:
        return "AlphaVantage"
    
    @property
    def priority(self) -> int:
        return 2  # Second priority after YFinance
    
    @property
    def supports_batch(self) -> bool:
        return False  # Free tier doesn't support batch
    
    def is_available(self) -> bool:
        """Check if API key is available and we haven't hit daily limit."""
        if not self.api_key:
            return False
        return self._request_count < self._daily_limit
    
    def _rate_limit(self):
        """Apply rate limiting for free tier."""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        
        if time_since_last < self._min_interval:
            sleep_time = self._min_interval - time_since_last
            self.logger.info(f"Rate limiting: sleeping {sleep_time:.1f}s")
            time.sleep(sleep_time)
        
        self._last_request_time = time.time()
        self._request_count += 1
    
    @retry_with_backoff(max_attempts=3, exceptions=(Exception,))
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """Fetch daily data using free TIME_SERIES_DAILY endpoint."""
        if not self.is_available():
            raise RuntimeError("AlphaVantage not available or daily limit reached")
        
        self._rate_limit()
        
        try:
            # Use TIME_SERIES_DAILY (free endpoint)
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': ticker,
                'outputsize': 'full',  # Get full historical data
                'apikey': self.api_key
            }
            
            self.logger.info(f"Fetching {ticker} from AlphaVantage TIME_SERIES_DAILY")
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Check for API errors
            if 'Error Message' in data:
                raise ValueError(f"AlphaVantage error: {data['Error Message']}")
            
            if 'Note' in data:
                raise ValueError(f"AlphaVantage rate limited: {data['Note']}")
            
            if 'Information' in data:
                raise ValueError(f"AlphaVantage info: {data['Information']}")
            
            # Extract time series data
            time_series_key = 'Time Series (Daily)'
            if time_series_key not in data:
                raise ValueError(f"No time series data found for {ticker}")
            
            time_series = data[time_series_key]
            
            # Convert to DataFrame
            df_data = []
            for date_str, values in time_series.items():
                try:
                    df_data.append({
                        'Date': pd.to_datetime(date_str),
                        'Open': float(values['1. open']),
                        'High': float(values['2. high']),
                        'Low': float(values['3. low']),
                        'Close': float(values['4. close']),
                        'Volume': int(values['5. volume']),
                        'Adj Close': float(values['4. close'])  # AlphaVantage doesn't provide adj close in free tier
                    })
                except (KeyError, ValueError) as e:
                    self.logger.warning(f"Skipping invalid data point for {date_str}: {e}")
                    continue
            
            if not df_data:
                raise ValueError(f"No valid data points for {ticker}")
            
            df = pd.DataFrame(df_data)
            df.set_index('Date', inplace=True)
            df.sort_index(inplace=True)
            
            # Filter by date range if specified
            if start_date:
                start_date = pd.to_datetime(start_date)
                df = df[df.index >= start_date]
            
            if end_date:
                end_date = pd.to_datetime(end_date)
                df = df[df.index <= end_date]
            
            self.logger.info(f"AlphaVantage returned {len(df)} data points for {ticker}")
            return df
            
        except Exception as e:
            self.logger.error(f"AlphaVantage error for {ticker}: {str(e)}")
            raise
    
    def get_quote(self, ticker: str) -> Dict:
        """Get real-time quote using GLOBAL_QUOTE endpoint."""
        if not self.is_available():
            raise RuntimeError("AlphaVantage not available or daily limit reached")
        
        self._rate_limit()
        
        try:
            params = {
                'function': 'GLOBAL_QUOTE',
                'symbol': ticker,
                'apikey': self.api_key
            }
            
            response = requests.get(self.base_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if 'Global Quote' in data:
                quote = data['Global Quote']
                return {
                    'symbol': quote.get('01. symbol', ticker),
                    'price': float(quote.get('05. price', 0)),
                    'change': float(quote.get('09. change', 0)),
                    'change_percent': quote.get('10. change percent', '0%'),
                    'volume': int(quote.get('06. volume', 0)),
                    'latest_trading_day': quote.get('07. latest trading day', ''),
                    'previous_close': float(quote.get('08. previous close', 0))
                }
            else:
                raise ValueError("No quote data available")
                
        except Exception as e:
            self.logger.error(f"AlphaVantage quote error for {ticker}: {str(e)}")
            raise