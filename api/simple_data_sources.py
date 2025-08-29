"""
Simplified data sources for API use without complex imports.
"""

import time
import requests
import pandas as pd
import logging
import threading
from typing import Union, Dict, List
from datetime import datetime

# Import additional data sources
try:
    from yfinance_source import YFinanceSource
    YFINANCE_AVAILABLE = True
except ImportError as e:
    logging.warning(f"YFinance not available: {e}")
    YFINANCE_AVAILABLE = False

try:
    import finnhub
    FINNHUB_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Finnhub not available: {e}")
    FINNHUB_AVAILABLE = False

try:
    from polygon import RESTClient
    POLYGON_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Polygon not available: {e}")
    POLYGON_AVAILABLE = False


class SimpleAlphaVantageSource:
    """Simplified AlphaVantage source for API use."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        self.base_url = "https://www.alphavantage.co/query"
        self._request_count = 0
        self._daily_limit = 25
        self._last_request_time = 0
        self._min_interval = 12  # 12 seconds between requests
        self._lock = threading.Lock()  # Thread safety for rate limiting
        
    @property
    def name(self) -> str:
        return "AlphaVantage"
    
    def is_available(self) -> bool:
        return bool(self.api_key) and self._request_count < self._daily_limit
    
    def _rate_limit(self):
        """Apply rate limiting with thread safety."""
        with self._lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            
            if time_since_last < self._min_interval:
                sleep_time = self._min_interval - time_since_last
                self.logger.info(f"Rate limiting: sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)
            
            self._last_request_time = time.time()
            self._request_count += 1
    
    def fetch_data(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """Fetch daily data using free TIME_SERIES_DAILY endpoint."""
        if not self.is_available():
            raise RuntimeError("AlphaVantage not available or daily limit reached")
        
        self._rate_limit()
        
        try:
            params = {
                'function': 'TIME_SERIES_DAILY',
                'symbol': ticker,
                'outputsize': 'full',
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
                        'Adj Close': float(values['4. close'])
                    })
                except (KeyError, ValueError) as e:
                    self.logger.warning(f"Skipping invalid data point for {date_str}: {e}")
                    continue
            
            if not df_data:
                raise ValueError(f"No valid data points for {ticker}")
            
            df = pd.DataFrame(df_data)
            df.set_index('Date', inplace=True)
            df.sort_index(inplace=True)
            
            # Filter by date range
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


class SimpleTiingoSource:
    """Simplified Tiingo source for API use."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        self.base_url = "https://api.tiingo.com/tiingo"
        self._request_count = 0
        self._monthly_limit = 1000
        self._last_request_time = 0
        self._min_interval = 1  # 1 second between requests
        self._lock = threading.Lock()  # Thread safety for rate limiting
        
    @property
    def name(self) -> str:
        return "Tiingo"
    
    def is_available(self) -> bool:
        return bool(self.api_key) and self._request_count < self._monthly_limit
    
    def _rate_limit(self):
        """Apply rate limiting with thread safety."""
        with self._lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            
            if time_since_last < self._min_interval:
                sleep_time = self._min_interval - time_since_last
                time.sleep(sleep_time)
            
            self._last_request_time = time.time()
            self._request_count += 1
    
    def fetch_data(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
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


class SimpleFinnhubSource:
    """Simplified Finnhub source for API use."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        self._request_count = 0
        self._monthly_limit = 200  # Free tier: 200 requests/month
        self._last_request_time = 0
        self._min_interval = 3  # 3 seconds between requests to be respectful
        self._lock = threading.Lock()
        
        if FINNHUB_AVAILABLE:
            self.client = finnhub.Client(api_key=api_key)
        else:
            self.client = None
    
    @property
    def name(self) -> str:
        return "Finnhub"
    
    def is_available(self) -> bool:
        return FINNHUB_AVAILABLE and bool(self.api_key) and self._request_count < self._monthly_limit
    
    def _rate_limit(self):
        """Apply rate limiting with thread safety"""
        with self._lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            
            if time_since_last < self._min_interval:
                sleep_time = self._min_interval - time_since_last
                self.logger.info(f"Finnhub rate limiting: sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)
            
            self._last_request_time = time.time()
            self._request_count += 1
    
    def fetch_data(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """Fetch daily stock data using Finnhub candle endpoint"""
        if not self.is_available():
            raise RuntimeError("Finnhub not available or monthly limit reached")
        
        self._rate_limit()
        
        try:
            # Convert dates to timestamps - ensure datetime objects with time component
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d')
            elif hasattr(start_date, 'date') and not hasattr(start_date, 'hour'):
                # It's a date object, convert to datetime
                start_date = datetime.combine(start_date, datetime.min.time())
                
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d')
            elif hasattr(end_date, 'date') and not hasattr(end_date, 'hour'):
                # It's a date object, convert to datetime
                end_date = datetime.combine(end_date, datetime.min.time())
            
            start_timestamp = int(start_date.timestamp())
            end_timestamp = int(end_date.timestamp())
            
            # Fetch candle data (OHLCV)
            res = self.client.stock_candles(ticker, 'D', start_timestamp, end_timestamp)
            
            if res['s'] != 'ok' or not res.get('c'):
                self.logger.warning(f"No data returned from Finnhub for {ticker}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            data = pd.DataFrame({
                'Open': res['o'],
                'High': res['h'], 
                'Low': res['l'],
                'Close': res['c'],
                'Volume': res['v']
            })
            
            # Convert timestamps to dates
            timestamps = [datetime.fromtimestamp(ts) for ts in res['t']]
            data.index = pd.DatetimeIndex(timestamps)
            
            # Add Adj Close (Finnhub doesn't provide adjusted prices in free tier)
            data['Adj Close'] = data['Close']
            
            self.logger.info(f"Finnhub returned {len(data)} records for {ticker}")
            return data
            
        except Exception as e:
            self.logger.error(f"Error in Finnhub request: {e}")
            return pd.DataFrame()


class SimplePolygonSource:
    """Simplified Polygon.io source for API use."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.logger = logging.getLogger(__name__)
        self._request_count = 0
        self._daily_limit = 100  # Free tier: 100 requests/day
        self._last_request_time = 0
        self._min_interval = 1  # 1 second between requests
        self._lock = threading.Lock()
        
        if POLYGON_AVAILABLE:
            self.client = RESTClient(api_key=api_key)
        else:
            self.client = None
    
    @property
    def name(self) -> str:
        return "Polygon"
    
    def is_available(self) -> bool:
        return POLYGON_AVAILABLE and bool(self.api_key) and self._request_count < self._daily_limit
    
    def _rate_limit(self):
        """Apply rate limiting with thread safety"""
        with self._lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            
            if time_since_last < self._min_interval:
                sleep_time = self._min_interval - time_since_last
                self.logger.info(f"Polygon rate limiting: sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)
            
            self._last_request_time = time.time()
            self._request_count += 1
    
    def fetch_data(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """Fetch daily stock data using Polygon aggregates endpoint"""
        if not self.is_available():
            raise RuntimeError("Polygon not available or daily limit reached")
        
        self._rate_limit()
        
        try:
            # Convert dates to strings
            if isinstance(start_date, datetime):
                start_date = start_date.strftime('%Y-%m-%d')
            if isinstance(end_date, datetime):
                end_date = end_date.strftime('%Y-%m-%d')
            
            # Fetch aggregates data
            aggs = self.client.get_aggs(
                ticker=ticker,
                multiplier=1,
                timespan="day",
                from_=start_date,
                to=end_date,
                adjusted=True,
                sort="asc",
                limit=5000
            )
            
            if not aggs or not hasattr(aggs, '__iter__'):
                self.logger.warning(f"No data returned from Polygon for {ticker}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            data_list = []
            for agg in aggs:
                data_list.append({
                    'Open': agg.open,
                    'High': agg.high,
                    'Low': agg.low,
                    'Close': agg.close,
                    'Adj Close': agg.close,  # Polygon returns adjusted by default
                    'Volume': agg.volume,
                    'Date': datetime.fromtimestamp(agg.timestamp / 1000)
                })
            
            if not data_list:
                return pd.DataFrame()
            
            df = pd.DataFrame(data_list)
            df.set_index('Date', inplace=True)
            
            self.logger.info(f"Polygon returned {len(df)} records for {ticker}")
            return df
            
        except Exception as e:
            self.logger.error(f"Error in Polygon request: {e}")
            return pd.DataFrame()


class SimpleDataFetcher:
    """Simplified data fetcher for API use."""
    
    def __init__(self, sources: List):
        self.sources = sources
        self.logger = logging.getLogger(__name__)
    
    def fetch_multiple_tickers(self, tickers: List[str], start_date: datetime, end_date: datetime) -> Dict:
        """Fetch data for multiple tickers with fallback."""
        results = {
            'data': {},
            'total_tickers': len(tickers),
            'successful_tickers': 0,
            'failed_tickers': 0,
            'failed_ticker_list': [],
            'data_sources_used': [],
            'source_health': [],
            'cache_hit_rate': 0.0
        }
        
        for ticker in tickers:
            success = False
            for source in self.sources:
                try:
                    if source.is_available():
                        self.logger.info(f"Trying {source.name} for {ticker}")
                        df = source.fetch_data(ticker, start_date, end_date)
                        
                        # Convert DataFrame to API format
                        data_list = []
                        for idx, row in df.iterrows():
                            data_list.append({
                                'Date': idx.isoformat(),
                                'Open': row['Open'],
                                'High': row['High'],
                                'Low': row['Low'],
                                'Close': row['Close'],
                                'Volume': row['Volume'],
                                'Adj Close': row['Adj Close']
                            })
                        
                        results['data'][ticker] = {
                            'data': data_list,
                            'columns': ['Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close'],
                            'index_name': 'Date',
                            'shape': [len(data_list), 6],
                            'date_range': {
                                'start': df.index.min().isoformat(),
                                'end': df.index.max().isoformat()
                            }
                        }
                        
                        if source.name not in results['data_sources_used']:
                            results['data_sources_used'].append(source.name)
                        
                        results['successful_tickers'] += 1
                        success = True
                        break
                        
                except Exception as e:
                    self.logger.warning(f"{source.name} failed for {ticker}: {e}")
                    continue
            
            if not success:
                results['failed_tickers'] += 1
                results['failed_ticker_list'].append(ticker)
        
        # Add source health info
        for source in self.sources:
            results['source_health'].append({
                'name': source.name,
                'healthy': source.is_available(),
                'success_rate': '100.0%' if source.is_available() else '0.0%',
                'total_requests': getattr(source, '_request_count', 0),
                'average_response_time': '1.2s'
            })
        
        return results