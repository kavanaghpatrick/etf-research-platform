"""
Production-ready YFinance data source with best practices.
Implements robust error handling, rate limiting, and data cleaning.
"""

import yfinance as yf
import pandas as pd
import requests
import time
import random
import logging
import threading
from datetime import datetime, timedelta
from typing import Union, Dict, List, Optional
from functools import wraps
import hashlib


class YFinanceError(Exception):
    """Base exception for YFinance operations"""
    pass


class RateLimitError(YFinanceError):
    """Raised when rate limit is exceeded"""
    pass


class DataNotFoundError(YFinanceError):
    """Raised when requested data is not available"""
    pass


class NetworkError(YFinanceError):
    """Raised for network-related issues"""
    pass


class UserAgentRotator:
    """Manages user agent rotation to avoid detection"""
    
    def __init__(self):
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0'
        ]
    
    def get_random_user_agent(self) -> str:
        """Get a random user agent"""
        return random.choice(self.user_agents)
    
    def get_recommended_headers(self) -> dict:
        """Get recommended headers for requests"""
        return {
            'User-Agent': self.get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
        }


class YFinanceDataProcessor:
    """Handles data cleaning and validation"""
    
    @staticmethod
    def clean_price_data(df: pd.DataFrame) -> pd.DataFrame:
        """Clean and validate price data"""
        if df is None or df.empty:
            return pd.DataFrame()
        
        # Remove rows with all NaN values
        df = df.dropna(how='all')
        
        if df.empty:
            return df
        
        # Forward fill missing values (conservative approach)
        df = df.fillna(method='ffill')
        
        # Remove unrealistic price movements (> 50% in a day)
        if 'Close' in df.columns:
            price_change = df['Close'].pct_change().abs()
            df = df[price_change <= 0.5]
        
        # Ensure positive prices
        price_columns = ['Open', 'High', 'Low', 'Close', 'Adj Close']
        for col in price_columns:
            if col in df.columns:
                df = df[df[col] > 0]
        
        # Validate OHLC relationships
        if all(col in df.columns for col in ['Open', 'High', 'Low', 'Close']):
            valid_ohlc = (
                (df['High'] >= df['Open']) & 
                (df['High'] >= df['Close']) & 
                (df['Low'] <= df['Open']) & 
                (df['Low'] <= df['Close'])
            )
            df = df[valid_ohlc]
        
        return df
    
    @staticmethod
    def standardize_format(df: pd.DataFrame) -> pd.DataFrame:
        """Standardize data format to match other sources"""
        if df.empty:
            return df
        
        # Ensure required columns exist
        required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise DataNotFoundError(f"Missing required columns: {missing_columns}")
        
        # Add Adj Close if missing
        if 'Adj Close' not in df.columns and 'Close' in df.columns:
            df['Adj Close'] = df['Close']
        
        # Ensure volume is integer
        if 'Volume' in df.columns:
            df['Volume'] = df['Volume'].fillna(0).astype(int)
        
        # Ensure timezone-naive datetime index
        if hasattr(df.index, 'tz') and df.index.tz is not None:
            df.index = df.index.tz_localize(None)
        
        return df


class YFinanceSource:
    """Production-ready YFinance data source with comprehensive error handling"""
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, min_interval: float = 0.5):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.min_interval = min_interval
        self.user_agent_rotator = UserAgentRotator()
        self.data_processor = YFinanceDataProcessor()
        self.logger = logging.getLogger(__name__)
        
        # Thread safety
        self._lock = threading.Lock()
        self._last_request_time = 0
        self._request_count = 0
        
        # Create session with recommended headers
        self.session = self._create_session()
    
    @property
    def name(self) -> str:
        return "YFinance"
    
    def _create_session(self) -> requests.Session:
        """Create a session with rotating headers"""
        session = requests.Session()
        headers = self.user_agent_rotator.get_recommended_headers()
        session.headers.update(headers)
        return session
    
    def _rotate_session(self):
        """Rotate session with new headers"""
        self.session = self._create_session()
    
    def _rate_limit(self):
        """Apply rate limiting with thread safety"""
        with self._lock:
            current_time = time.time()
            time_since_last = current_time - self._last_request_time
            
            if time_since_last < self.min_interval:
                sleep_time = self.min_interval - time_since_last
                self.logger.info(f"Rate limiting: sleeping {sleep_time:.1f}s")
                time.sleep(sleep_time)
            
            self._last_request_time = time.time()
            self._request_count += 1
    
    def is_available(self) -> bool:
        """Check if YFinance is available (always True as it's a fallback)"""
        return True
    
    def _handle_errors(self, func):
        """Decorator to handle common YFinance errors"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 429:
                    raise RateLimitError(f"Rate limit exceeded: {e}")
                elif e.response.status_code == 404:
                    raise DataNotFoundError(f"Data not found: {e}")
                else:
                    raise NetworkError(f"HTTP error: {e}")
            except requests.exceptions.ConnectionError as e:
                raise NetworkError(f"Connection error: {e}")
            except requests.exceptions.Timeout as e:
                raise NetworkError(f"Timeout error: {e}")
            except Exception as e:
                if "No data found" in str(e) or "No timezone found" in str(e):
                    raise DataNotFoundError(f"No data available: {e}")
                else:
                    raise YFinanceError(f"Unexpected error: {e}")
        return wrapper
    
    def _retry_with_backoff(self, func):
        """Decorator for retry logic with exponential backoff"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(self.max_retries):
                try:
                    return func(*args, **kwargs)
                except (RateLimitError, NetworkError) as e:
                    last_error = e
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                        self.logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay:.2f}s")
                        time.sleep(delay)
                        # Rotate session on retry
                        self._rotate_session()
                    else:
                        self.logger.error(f"Max retries exceeded. Last error: {e}")
                        raise e
                except DataNotFoundError as e:
                    # Don't retry for data not found errors
                    raise e
                except Exception as e:
                    last_error = e
                    if attempt < self.max_retries - 1:
                        delay = self.base_delay * (2 ** attempt)
                        self.logger.warning(f"Unexpected error on attempt {attempt + 1}: {e}. Retrying in {delay:.2f}s")
                        time.sleep(delay)
                    else:
                        raise e
            
            if last_error:
                raise last_error
            
        return wrapper
    
    def _fetch_ticker_data(self, symbol: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Internal method to fetch ticker data"""
        self._rate_limit()
        
        try:
            # Create ticker object - let YFinance handle session management
            ticker = yf.Ticker(symbol)
            
            # Fetch historical data
            data = ticker.history(
                start=start_date,
                end=end_date + timedelta(days=1),  # YFinance end date is exclusive
                auto_adjust=True,
                prepost=False,
                repair=True  # Automatically repair bad data
            )
            
            if data.empty:
                raise DataNotFoundError(f"No data returned for {symbol}")
            
            self.logger.info(f"Successfully fetched {len(data)} records for {symbol} from YFinance")
            return data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch {symbol} from YFinance: {e}")
            raise
    
    def fetch_data(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """Fetch daily stock data using YFinance with comprehensive error handling"""
        
        # Normalize inputs
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
        ticker = ticker.upper().strip()
        
        try:
            # Fetch raw data with retry logic
            raw_data = self._retry_with_backoff(self._handle_errors(self._fetch_ticker_data))(ticker, start_date, end_date)
            
            # Process and clean data
            cleaned_data = self.data_processor.clean_price_data(raw_data)
            standardized_data = self.data_processor.standardize_format(cleaned_data)
            
            self.logger.info(f"YFinance returned {len(standardized_data)} cleaned records for {ticker}")
            return standardized_data
            
        except DataNotFoundError:
            self.logger.warning(f"No data found for {ticker} in YFinance")
            return pd.DataFrame()
        except Exception as e:
            self.logger.error(f"Error fetching {ticker} from YFinance: {e}")
            return pd.DataFrame()
    
    def get_bulk_data(self, symbols: List[str], start_date: datetime, end_date: datetime, 
                      batch_size: int = 20, delay_between_batches: float = 2.0) -> Dict[str, pd.DataFrame]:
        """
        Fetch data for multiple symbols with controlled batching.
        Note: Individual requests are more reliable than yf.download() for error handling.
        """
        results = {}
        
        for i, symbol in enumerate(symbols):
            try:
                data = self.fetch_data(symbol, start_date, end_date)
                results[symbol] = data
                
                # Add delay between requests
                if i < len(symbols) - 1:
                    time.sleep(0.5)
                    
                # Longer delay after each batch
                if (i + 1) % batch_size == 0 and i < len(symbols) - 1:
                    self.logger.info(f"Completed batch {(i + 1) // batch_size}. Waiting {delay_between_batches}s...")
                    time.sleep(delay_between_batches)
                    
            except Exception as e:
                self.logger.error(f"Failed to fetch {symbol}: {e}")
                results[symbol] = pd.DataFrame()
        
        return results
    
    def validate_ticker(self, ticker: str) -> bool:
        """Validate if ticker exists by attempting a quick fetch"""
        try:
            # Try to fetch just one day of recent data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=5)  # 5 days to account for weekends
            
            data = self._fetch_ticker_data(ticker, start_date, end_date)
            return not data.empty
            
        except DataNotFoundError:
            return False
        except Exception as e:
            self.logger.warning(f"Error validating ticker {ticker}: {e}")
            return False
    
    def get_info(self, ticker: str) -> Dict:
        """Get basic ticker information"""
        try:
            self._rate_limit()
            yf_ticker = yf.Ticker(ticker)
            info = yf_ticker.info
            
            return {
                'symbol': ticker,
                'name': info.get('longName', ticker),
                'sector': info.get('sector', 'Unknown'),
                'industry': info.get('industry', 'Unknown'),
                'exchange': info.get('exchange', 'Unknown'),
                'currency': info.get('currency', 'USD'),
                'source': 'YFinance'
            }
        except Exception as e:
            self.logger.warning(f"Could not get info for {ticker}: {e}")
            return {'symbol': ticker, 'source': 'YFinance'}
    
    def _fetch_dividend_data(self, symbol: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Internal method to fetch dividend data"""
        self._rate_limit()
        
        try:
            # Create ticker object
            ticker = yf.Ticker(symbol)
            
            # Fetch dividend data
            dividends = ticker.dividends
            
            if dividends.empty:
                self.logger.info(f"No dividend data found for {symbol}")
                return pd.DataFrame()
            
            # Ensure timezone-naive index for comparison
            if hasattr(dividends.index, 'tz') and dividends.index.tz is not None:
                dividends.index = dividends.index.tz_localize(None)
            
            # Filter by date range (convert dates to datetime for comparison)
            start_datetime = pd.Timestamp(start_date)
            end_datetime = pd.Timestamp(end_date)
            
            dividends = dividends[
                (dividends.index >= start_datetime) & 
                (dividends.index <= end_datetime)
            ]
            
            if dividends.empty:
                self.logger.info(f"No dividend data for {symbol} in date range {start_date} to {end_date}")
                return pd.DataFrame()
            
            # Convert to DataFrame with consistent structure
            dividend_df = pd.DataFrame({
                'ex_date': dividends.index,
                'dividend_amount': dividends.values,
                'symbol': symbol,
                'dividend_type': 'regular',
                'currency': 'USD',
                'adjustment_factor': 1.0,
                'source': 'YFinance'
            })
            
            # Reset index to make ex_date a column
            dividend_df.reset_index(drop=True, inplace=True)
            
            self.logger.info(f"Successfully fetched {len(dividend_df)} dividend records for {symbol}")
            return dividend_df
            
        except Exception as e:
            self.logger.error(f"Failed to fetch dividend data for {symbol}: {e}")
            raise
    
    def fetch_dividends(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """
        Fetch dividend data for a ticker within a date range.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for dividend data
            end_date: End date for dividend data
            
        Returns:
            DataFrame with dividend information matching the schema
        """
        # Normalize inputs
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
        ticker = ticker.upper().strip()
        
        try:
            # Fetch dividend data with retry logic
            dividend_data = self._retry_with_backoff(self._handle_errors(self._fetch_dividend_data))(ticker, start_date, end_date)
            
            if dividend_data.empty:
                self.logger.info(f"No dividends found for {ticker} between {start_date} and {end_date}")
                return pd.DataFrame()
            
            # Ensure timezone-naive datetime for ex_date
            if 'ex_date' in dividend_data.columns and hasattr(dividend_data['ex_date'], 'dt'):
                if hasattr(dividend_data['ex_date'].dt, 'tz') and dividend_data['ex_date'].dt.tz is not None:
                    dividend_data['ex_date'] = dividend_data['ex_date'].dt.tz_localize(None)
            
            return dividend_data
            
        except DataNotFoundError:
            self.logger.warning(f"No dividend data found for {ticker} in YFinance")
            return pd.DataFrame()
        except Exception as e:
            self.logger.error(f"Error fetching dividends for {ticker}: {e}")
            return pd.DataFrame()
    
    def get_dividend_calendar(self, ticker: str) -> pd.DataFrame:
        """
        Get comprehensive dividend calendar including payment dates and other details.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            DataFrame with dividend calendar information
        """
        ticker = ticker.upper().strip()
        
        try:
            self._rate_limit()
            yf_ticker = yf.Ticker(ticker)
            
            # Get all available dividend data
            dividends = yf_ticker.dividends
            
            if dividends.empty:
                self.logger.info(f"No dividend history found for {ticker}")
                return pd.DataFrame()
            
            # Get corporate actions for additional dividend info
            actions = yf_ticker.actions
            
            # Create comprehensive dividend calendar
            calendar_df = pd.DataFrame({
                'symbol': ticker,
                'ex_date': dividends.index,
                'dividend_amount': dividends.values,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            })
            
            # Reset index
            calendar_df.reset_index(drop=True, inplace=True)
            
            # If actions DataFrame has dividend info, merge it
            if not actions.empty and 'Dividends' in actions.columns:
                # Extract additional dividend info from actions
                div_actions = actions[actions['Dividends'] > 0][['Dividends']]
                if not div_actions.empty:
                    # Add any missing dividend dates from actions
                    for date, row in div_actions.iterrows():
                        if date not in calendar_df['ex_date'].values:
                            new_row = pd.DataFrame({
                                'symbol': [ticker],
                                'ex_date': [date],
                                'dividend_amount': [row['Dividends']],
                                'dividend_type': ['regular'],
                                'currency': ['USD'],
                                'source': ['YFinance']
                            })
                            calendar_df = pd.concat([calendar_df, new_row], ignore_index=True)
            
            # Sort by ex_date descending
            calendar_df = calendar_df.sort_values('ex_date', ascending=False)
            
            # Ensure timezone-naive datetime
            if hasattr(calendar_df['ex_date'], 'dt') and hasattr(calendar_df['ex_date'].dt, 'tz'):
                if calendar_df['ex_date'].dt.tz is not None:
                    calendar_df['ex_date'] = calendar_df['ex_date'].dt.tz_localize(None)
            
            # Infer payment frequency
            if len(calendar_df) >= 2:
                # Calculate average days between dividends
                date_diffs = calendar_df['ex_date'].diff().dt.days.dropna().abs()
                avg_days = date_diffs.mean()
                
                if avg_days <= 35:
                    frequency = 'monthly'
                elif avg_days <= 100:
                    frequency = 'quarterly'
                elif avg_days <= 200:
                    frequency = 'semi_annual'
                else:
                    frequency = 'annual'
                
                calendar_df['payment_frequency'] = frequency
            else:
                calendar_df['payment_frequency'] = 'irregular'
            
            self.logger.info(f"Retrieved dividend calendar with {len(calendar_df)} entries for {ticker}")
            return calendar_df
            
        except Exception as e:
            self.logger.error(f"Error getting dividend calendar for {ticker}: {e}")
            return pd.DataFrame()
    
    def _fetch_split_data(self, symbol: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
        """Internal method to fetch stock split data"""
        self._rate_limit()
        
        try:
            # Create ticker object
            ticker = yf.Ticker(symbol)
            
            # Fetch splits data
            splits = ticker.splits
            
            if splits.empty:
                self.logger.info(f"No split data found for {symbol}")
                return pd.DataFrame()
            
            # Filter by date range
            splits = splits[
                (splits.index >= start_date) & 
                (splits.index <= end_date)
            ]
            
            if splits.empty:
                self.logger.info(f"No splits for {symbol} in date range {start_date} to {end_date}")
                return pd.DataFrame()
            
            # Convert to DataFrame with consistent structure
            split_df = pd.DataFrame({
                'symbol': symbol,
                'ex_date': splits.index,
                'split_ratio': splits.values,
                'action_type': 'split',
                'source': 'YFinance'
            })
            
            # Calculate ratio_from and ratio_to
            # YFinance provides the multiplier (e.g., 2.0 for 2:1 split)
            split_df['ratio_to'] = split_df['split_ratio']
            split_df['ratio_from'] = 1.0
            
            # Handle reverse splits (ratio < 1)
            reverse_splits = split_df['split_ratio'] < 1
            split_df.loc[reverse_splits, 'action_type'] = 'reverse_split'
            split_df.loc[reverse_splits, 'ratio_from'] = 1.0 / split_df.loc[reverse_splits, 'split_ratio']
            split_df.loc[reverse_splits, 'ratio_to'] = 1.0
            
            # Add description
            split_df['description'] = split_df.apply(
                lambda row: f"{row['ratio_to']:.0f}:{row['ratio_from']:.0f} stock split" 
                if row['action_type'] == 'split' 
                else f"{row['ratio_from']:.0f}:{row['ratio_to']:.0f} reverse split",
                axis=1
            )
            
            # Reset index
            split_df.reset_index(drop=True, inplace=True)
            
            self.logger.info(f"Successfully fetched {len(split_df)} split records for {symbol}")
            return split_df
            
        except Exception as e:
            self.logger.error(f"Failed to fetch split data for {symbol}: {e}")
            raise
    
    def fetch_splits(self, ticker: str, start_date: Union[str, datetime], end_date: Union[str, datetime]) -> pd.DataFrame:
        """
        Fetch stock split data for a ticker within a date range.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for split data
            end_date: End date for split data
            
        Returns:
            DataFrame with split information matching the corporate_actions schema
        """
        # Normalize inputs
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d')
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d')
        
        ticker = ticker.upper().strip()
        
        try:
            # Fetch split data with retry logic
            split_data = self._retry_with_backoff(self._handle_errors(self._fetch_split_data))(ticker, start_date, end_date)
            
            if split_data.empty:
                self.logger.info(f"No splits found for {ticker} between {start_date} and {end_date}")
                return pd.DataFrame()
            
            # Ensure timezone-naive datetime for ex_date
            if 'ex_date' in split_data.columns and hasattr(split_data['ex_date'], 'dt'):
                if hasattr(split_data['ex_date'].dt, 'tz') and split_data['ex_date'].dt.tz is not None:
                    split_data['ex_date'] = split_data['ex_date'].dt.tz_localize(None)
            
            return split_data
            
        except DataNotFoundError:
            self.logger.warning(f"No split data found for {ticker} in YFinance")
            return pd.DataFrame()
        except Exception as e:
            self.logger.error(f"Error fetching splits for {ticker}: {e}")
            return pd.DataFrame()
    
    def get_all_corporate_actions(self, ticker: str) -> pd.DataFrame:
        """
        Get all corporate actions (dividends and splits) for a ticker.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            DataFrame with all corporate actions
        """
        ticker = ticker.upper().strip()
        
        try:
            self._rate_limit()
            yf_ticker = yf.Ticker(ticker)
            
            # Get actions DataFrame which includes both dividends and splits
            actions = yf_ticker.actions
            
            if actions.empty:
                self.logger.info(f"No corporate actions found for {ticker}")
                return pd.DataFrame()
            
            actions_list = []
            
            # Process stock splits
            if 'Stock Splits' in actions.columns:
                splits = actions[actions['Stock Splits'] > 0][['Stock Splits']]
                for date, row in splits.iterrows():
                    split_ratio = row['Stock Splits']
                    action_type = 'split' if split_ratio >= 1 else 'reverse_split'
                    
                    if action_type == 'split':
                        ratio_to = split_ratio
                        ratio_from = 1.0
                    else:
                        ratio_from = 1.0 / split_ratio
                        ratio_to = 1.0
                    
                    actions_list.append({
                        'symbol': ticker,
                        'action_type': action_type,
                        'ex_date': date,
                        'ratio_from': ratio_from,
                        'ratio_to': ratio_to,
                        'description': f"{ratio_to:.0f}:{ratio_from:.0f} {'stock split' if action_type == 'split' else 'reverse split'}",
                        'source': 'YFinance'
                    })
            
            # Process special dividends if any
            if 'Dividends' in actions.columns:
                # YFinance doesn't distinguish regular vs special dividends in actions
                # But we can use this for validation or additional info
                pass
            
            if not actions_list:
                return pd.DataFrame()
            
            # Create DataFrame
            actions_df = pd.DataFrame(actions_list)
            
            # Ensure timezone-naive datetime
            if hasattr(actions_df['ex_date'], 'dt') and hasattr(actions_df['ex_date'].dt, 'tz'):
                if actions_df['ex_date'].dt.tz is not None:
                    actions_df['ex_date'] = actions_df['ex_date'].dt.tz_localize(None)
            
            # Sort by ex_date descending
            actions_df = actions_df.sort_values('ex_date', ascending=False)
            
            self.logger.info(f"Retrieved {len(actions_df)} corporate actions for {ticker}")
            return actions_df
            
        except Exception as e:
            self.logger.error(f"Error getting corporate actions for {ticker}: {e}")
            return pd.DataFrame()
    
    def close(self):
        """Clean up resources"""
        if hasattr(self, 'session'):
            self.session.close()
        self.logger.info("YFinance source closed")