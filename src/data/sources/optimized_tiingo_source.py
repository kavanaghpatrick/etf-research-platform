"""
Optimized Tiingo source for free tier usage.
Maximizes the 1000 requests/month limit.
"""

import time
import requests
import pandas as pd
import logging
from typing import Union, Dict
from datetime import datetime

from .base import DataSource
from ...utils import Config, retry_with_backoff


class OptimizedTiingoSource(DataSource):
    """Optimized Tiingo source for free tier (1000 calls/month)."""
    
    def __init__(self, config=None, api_key=None):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.api_key = api_key or self._get_api_key()
        self.base_url = "https://api.tiingo.com/tiingo"
        self._request_count = 0
        self._monthly_limit = 1000
        self._last_request_time = 0
        self._min_interval = 1  # 1 second between requests
        
    def _get_api_key(self) -> str:
        """Get API key from environment or config."""
        import os
        api_key = os.environ.get('TIINGO_API_KEY')
        if not api_key and self.config:
            api_key = getattr(self.config.data, 'tiingo_api_key', None)
        return api_key or ""
    
    @property
    def name(self) -> str:
        return "Tiingo"
    
    @property
    def priority(self) -> int:
        return 3  # Third priority
    
    @property
    def supports_batch(self) -> bool:
        return False  # Conservative for free tier
    
    def is_available(self) -> bool:
        """Check if API key is available and we haven't hit monthly limit."""
        if not self.api_key:
            return False
        return self._request_count < self._monthly_limit
    
    def _rate_limit(self):
        """Apply conservative rate limiting for free tier."""
        current_time = time.time()
        time_since_last = current_time - self._last_request_time
        
        if time_since_last < self._min_interval:
            sleep_time = self._min_interval - time_since_last
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
        """Fetch daily prices using Tiingo daily prices endpoint."""
        if not self.is_available():
            raise RuntimeError("Tiingo not available or monthly limit reached")
        
        self._rate_limit()
        
        try:
            # Format dates
            if isinstance(start_date, datetime):
                start_date = start_date.strftime('%Y-%m-%d')
            if isinstance(end_date, datetime):
                end_date = end_date.strftime('%Y-%m-%d')
            
            # Use daily prices endpoint
            url = f"{self.base_url}/daily/{ticker}/prices"
            
            params = {
                'startDate': start_date,
                'endDate': end_date or datetime.now().strftime('%Y-%m-%d'),
                'format': 'json'
            }
            
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Token {self.api_key}'
            }
            
            self.logger.info(f"Fetching {ticker} from Tiingo daily prices")
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if not data:
                raise ValueError(f"No data returned for {ticker}")
            
            # Convert to DataFrame
            df_data = []
            for item in data:
                try:
                    df_data.append({
                        'Date': pd.to_datetime(item['date']),
                        'Open': float(item['open']),
                        'High': float(item['high']),
                        'Low': float(item['low']),
                        'Close': float(item['close']),
                        'Volume': int(item['volume']),
                        'Adj Close': float(item['adjClose'])
                    })
                except (KeyError, ValueError) as e:
                    self.logger.warning(f"Skipping invalid data point: {e}")
                    continue
            
            if not df_data:
                raise ValueError(f"No valid data points for {ticker}")
            
            df = pd.DataFrame(df_data)
            df.set_index('Date', inplace=True)
            df.sort_index(inplace=True)
            
            self.logger.info(f"Tiingo returned {len(df)} data points for {ticker}")
            return df
            
        except Exception as e:
            self.logger.error(f"Tiingo error for {ticker}: {str(e)}")
            raise
    
    def get_metadata(self, ticker: str) -> Dict:
        """Get ticker metadata."""
        if not self.is_available():
            raise RuntimeError("Tiingo not available or monthly limit reached")
        
        self._rate_limit()
        
        try:
            url = f"{self.base_url}/daily/{ticker}"
            
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Token {self.api_key}'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            return {
                'ticker': data.get('ticker', ticker),
                'name': data.get('name', ''),
                'description': data.get('description', ''),
                'start_date': data.get('startDate', ''),
                'end_date': data.get('endDate', '')
            }
            
        except Exception as e:
            self.logger.error(f"Tiingo metadata error for {ticker}: {str(e)}")
            raise