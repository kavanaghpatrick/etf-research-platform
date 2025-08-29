"""
Total Return Calculator with Dividend Support
Provides comprehensive total return calculations including dividend reinvestment
"""

import os
import sqlite3
import logging
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Union
from datetime import datetime, date, timedelta
from dataclasses import dataclass, asdict
from contextlib import contextmanager
import json

from sqlite_cache_manager import SQLiteStockDataCache
from yfinance_source import YFinanceSource


@dataclass
class TotalReturnMetrics:
    """Container for total return calculation results"""
    ticker: str
    start_date: date
    end_date: date
    initial_price: float
    final_price: float
    price_return: float
    dividend_return: float
    total_return: float
    annualized_return: float
    cagr: float
    total_dividends: float
    dividend_count: int
    dividend_yield: float
    years: float
    reinvested_value: Optional[float] = None
    reinvested_return: Optional[float] = None
    

@dataclass
class DividendInfo:
    """Container for dividend information"""
    ticker: str
    ex_date: date
    dividend_amount: float
    payment_date: Optional[date] = None
    record_date: Optional[date] = None
    dividend_type: str = 'regular'
    currency: str = 'USD'
    adjustment_factor: float = 1.0
    source: str = 'unknown'


class TotalReturnCalculator:
    """
    Comprehensive total return calculator with dividend support.
    Integrates with existing cache system and supports multiple calculation methods.
    """
    
    def __init__(self, cache_manager=None, database_url: str = None):
        self.logger = logging.getLogger(__name__)
        
        # Use shared cache manager if provided, otherwise create new one
        if cache_manager:
            self.cache_manager = cache_manager
            self.database_url = None
            self.db_path = None
        else:
            self.database_url = database_url or os.getenv('DATABASE_URL', 'sqlite:///data/etf_platform.db')
            self.db_path = self._extract_db_path()
            # Initialize cache manager only if not provided
            self.cache_manager = SQLiteStockDataCache(database_url)
        
        # Initialize data source
        self.data_source = YFinanceSource()
        
        # Always ensure dividend tables exist (shared cache manager might not have them)
        self._initialize_dividend_tables()
        
        self.logger.info("Initialized Total Return Calculator")
    
    def _extract_db_path(self) -> str:
        """Extract file path from SQLite URL"""
        if self.database_url.startswith('sqlite:///'):
            return self.database_url[10:]
        elif self.database_url.startswith('sqlite://'):
            return self.database_url[9:]
        else:
            return self.database_url
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def _initialize_dividend_tables(self):
        """Create dividend tables and views if they don't exist"""
        try:
            # Use cache manager's connection when available
            if hasattr(self.cache_manager, 'get_connection'):
                with self.cache_manager.get_connection() as conn:
                    self._create_dividend_tables(conn)
            else:
                with self.get_connection() as conn:
                    self._create_dividend_tables(conn)
            self.logger.info("Dividend tables and views initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize dividend tables: {e}")
            raise
    
    def _create_dividend_tables(self, conn):
        """Create the actual dividend tables"""
        try:
                # Create dividends table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS dividends (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        ex_date DATE NOT NULL,
                        dividend_amount DECIMAL(12,6) NOT NULL,
                        payment_date DATE,
                        record_date DATE,
                        dividend_type VARCHAR(20) DEFAULT 'regular',
                        currency VARCHAR(3) DEFAULT 'USD',
                        adjustment_factor DECIMAL(10,6) DEFAULT 1.0,
                        source VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker_symbol, ex_date, dividend_type)
                    )
                """)
                
                # Create dividend cache tracking table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS dividend_cache_ranges (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        source VARCHAR(50) NOT NULL,
                        dividend_count INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create corporate actions table for splits
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS corporate_actions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        action_type VARCHAR(20) NOT NULL,
                        ex_date DATE NOT NULL,
                        ratio_from DECIMAL(10,4),
                        ratio_to DECIMAL(10,4),
                        description TEXT,
                        source VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker_symbol, ex_date, action_type)
                    )
                """)
                
                # Create indexes
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker_symbol, ex_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividend_cache_ticker ON dividend_cache_ranges(ticker_symbol)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_corporate_actions_ticker ON corporate_actions(ticker_symbol, ex_date)")
                
                # Create useful views
                conn.execute("""
                    CREATE VIEW IF NOT EXISTS stock_data_with_dividends AS
                    SELECT 
                        s.*,
                        d.dividend_amount,
                        d.dividend_type,
                        d.adjustment_factor
                    FROM stock_data s
                    LEFT JOIN dividends d ON s.ticker_symbol = d.ticker_symbol 
                        AND s.date = d.ex_date
                    ORDER BY s.ticker_symbol, s.date
                """)
                
                conn.execute("""
                    CREATE VIEW IF NOT EXISTS dividend_summary AS
                    SELECT 
                        ticker_symbol,
                        COUNT(*) as dividend_count,
                        SUM(dividend_amount) as total_dividends,
                        AVG(dividend_amount) as avg_dividend,
                        MIN(ex_date) as first_dividend,
                        MAX(ex_date) as last_dividend,
                        ROUND(COUNT(*) * 365.0 / 
                            NULLIF(JULIANDAY(MAX(ex_date)) - JULIANDAY(MIN(ex_date)), 0), 1) 
                            as dividends_per_year
                    FROM dividends
                    WHERE dividend_type = 'regular'
                    GROUP BY ticker_symbol
                """)
                
                conn.commit()
                self.logger.info("Dividend tables and views initialized successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to initialize dividend tables: {e}")
            raise
    
    def fetch_and_cache_dividends(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        """
        Fetch dividend data using intelligent gap detection.
        Returns complete dividend information for the requested date range.
        """
        try:
            # Use cache manager's gap detection to identify missing ranges
            missing_ranges = self.cache_manager.get_missing_dividend_ranges(ticker, start_date, end_date)
            
            if not missing_ranges:
                # All data is cached - retrieve from cache using cache_manager
                with self.cache_manager.get_connection() as conn:
                    query = """
                        SELECT * FROM dividends 
                        WHERE ticker_symbol = ? 
                        AND ex_date >= ? 
                        AND ex_date <= ?
                        ORDER BY ex_date DESC
                    """
                    cursor = conn.execute(query, (ticker, start_date.isoformat(), end_date.isoformat()))
                    rows = cursor.fetchall()
                    
                    if rows:
                        df = pd.DataFrame([dict(row) for row in rows])
                        df['ex_date'] = pd.to_datetime(df['ex_date'])
                        self.logger.info(f"Retrieved {len(df)} cached dividend records for {ticker}")
                        return df
                    else:
                        # No cached data found, but no missing ranges detected
                        # This means we've checked this range before and found no dividends
                        self.logger.info(f"No dividends found for {ticker} in cached range {start_date} to {end_date}")
                        return pd.DataFrame()
            
            # Fetch missing data ranges from data source
            all_new_data = []
            for date_range in missing_ranges:
                self.logger.info(f"Fetching missing dividend data for {ticker} from {date_range.start_date} to {date_range.end_date}")
                
                try:
                    new_dividend_df = self.data_source.fetch_dividends(
                        ticker, date_range.start_date, date_range.end_date
                    )
                    
                    if not new_dividend_df.empty:
                        all_new_data.append(new_dividend_df)
                        self.logger.info(f"Fetched {len(new_dividend_df)} new dividend records for {ticker}")
                    
                    # Cache the data (even if empty) to track the range
                    success = self.cache_manager.cache_dividend_data(
                        ticker, new_dividend_df, date_range.start_date, date_range.end_date, 
                        self.data_source.name
                    )
                    
                    if success:
                        self.logger.debug(f"Successfully cached dividend range for {ticker}: {date_range.start_date} to {date_range.end_date}")
                    else:
                        self.logger.warning(f"Failed to cache dividend range for {ticker}: {date_range.start_date} to {date_range.end_date}")
                        
                except Exception as range_error:
                    self.logger.error(f"Error fetching dividend range {date_range.start_date}-{date_range.end_date} for {ticker}: {range_error}")
                    continue
            
            # Get all cached data for the requested range (including newly cached data)
            with self.get_connection() as conn:
                query = """
                    SELECT * FROM dividends 
                    WHERE ticker_symbol = ? 
                    AND ex_date >= ? 
                    AND ex_date <= ?
                    ORDER BY ex_date DESC
                """
                cursor = conn.execute(query, (ticker, start_date.isoformat(), end_date.isoformat()))
                rows = cursor.fetchall()
                
                if rows:
                    df = pd.DataFrame([dict(row) for row in rows])
                    df['ex_date'] = pd.to_datetime(df['ex_date'])
                    
                    # Standardize column names for API response
                    if 'ticker_symbol' not in df.columns and 'symbol' in df.columns:
                        df = df.rename(columns={'symbol': 'ticker_symbol'})
                    
                    self.logger.info(f"Returning {len(df)} complete dividend records for {ticker}")
                    return df
                else:
                    self.logger.info(f"No dividends found for {ticker} in requested range {start_date} to {end_date}")
                    return pd.DataFrame()
            
        except Exception as e:
            self.logger.error(f"Error fetching dividends with gap detection for {ticker}: {e}")
            return pd.DataFrame()
    
    def calculate_simple_total_return(self, ticker: str, start_date: Union[str, date], 
                                    end_date: Union[str, date]) -> TotalReturnMetrics:
        """
        Calculate simple total return including price appreciation and dividends.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for calculation
            end_date: End date for calculation
            
        Returns:
            TotalReturnMetrics object with calculation results
        """
        # Normalize dates
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        ticker = ticker.upper().strip()
        
        try:
            # Get price data
            price_data = self.cache_manager.get_cached_data(ticker, start_date, end_date)
            
            if price_data.empty:
                # Try to fetch from source
                self.logger.info(f"No cached price data for {ticker}, fetching from source")
                price_data = self.data_source.fetch_data(ticker, start_date, end_date)
                
                if not price_data.empty:
                    # Cache the data
                    self.cache_manager.cache_data(ticker, price_data, self.data_source.name)
            
            if price_data.empty:
                raise ValueError(f"No price data available for {ticker}")
            
            # Get dividend data
            dividend_df = self.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            # Calculate returns
            initial_price = price_data['Adj Close'].iloc[0]
            final_price = price_data['Adj Close'].iloc[-1]
            
            # Price return
            price_return = (final_price - initial_price) / initial_price
            
            # Dividend return
            total_dividends = dividend_df['dividend_amount'].sum() if not dividend_df.empty else 0
            dividend_return = total_dividends / initial_price
            
            # Total return
            total_return = price_return + dividend_return
            
            # Calculate time period
            years = (end_date - start_date).days / 365.25
            
            # Annualized return
            annualized_return = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0
            
            # CAGR (same as annualized return for simple calculation)
            cagr = annualized_return
            
            # Dividend yield (annualized)
            dividend_yield = (total_dividends / initial_price) / years if years > 0 else 0
            
            return TotalReturnMetrics(
                ticker=ticker,
                start_date=start_date,
                end_date=end_date,
                initial_price=initial_price,
                final_price=final_price,
                price_return=price_return,
                dividend_return=dividend_return,
                total_return=total_return,
                annualized_return=annualized_return,
                cagr=cagr,
                total_dividends=total_dividends,
                dividend_count=len(dividend_df),
                dividend_yield=dividend_yield,
                years=years
            )
            
        except Exception as e:
            self.logger.error(f"Error calculating total return for {ticker}: {e}")
            raise
    
    def calculate_dividend_reinvested_return(self, ticker: str, start_date: Union[str, date], 
                                           end_date: Union[str, date], 
                                           initial_investment: float = 10000) -> TotalReturnMetrics:
        """
        Calculate total return with dividend reinvestment.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for calculation
            end_date: End date for calculation
            initial_investment: Initial investment amount (default $10,000)
            
        Returns:
            TotalReturnMetrics object with reinvestment calculations
        """
        # Normalize dates
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        ticker = ticker.upper().strip()
        
        try:
            # Get price data
            price_data = self.cache_manager.get_cached_data(ticker, start_date, end_date)
            
            if price_data.empty:
                price_data = self.data_source.fetch_data(ticker, start_date, end_date)
                if not price_data.empty:
                    self.cache_manager.cache_data(ticker, price_data, self.data_source.name)
            
            if price_data.empty:
                raise ValueError(f"No price data available for {ticker}")
            
            # Get dividend data
            dividend_df = self.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            # Initialize portfolio
            initial_price = price_data['Adj Close'].iloc[0]
            shares = initial_investment / initial_price
            cash = 0
            
            # Track reinvestment history
            reinvestment_history = []
            
            # Process dividends
            for _, dividend in dividend_df.iterrows():
                div_date = dividend['ex_date']
                
                # Find price on ex-dividend date
                if div_date in price_data.index:
                    ex_price = price_data.loc[div_date, 'Adj Close']
                else:
                    # Use nearest available price
                    nearest_idx = price_data.index.get_indexer([div_date], method='nearest')[0]
                    ex_price = price_data['Adj Close'].iloc[nearest_idx]
                
                # Calculate dividend payment
                dividend_payment = shares * dividend['dividend_amount']
                
                # Reinvest dividend
                new_shares = dividend_payment / ex_price
                shares += new_shares
                
                reinvestment_history.append({
                    'date': div_date,
                    'dividend_per_share': dividend['dividend_amount'],
                    'total_dividend': dividend_payment,
                    'reinvest_price': ex_price,
                    'shares_purchased': new_shares,
                    'total_shares': shares
                })
            
            # Calculate final value
            final_price = price_data['Adj Close'].iloc[-1]
            final_value = shares * final_price + cash
            
            # Calculate returns
            reinvested_return = (final_value - initial_investment) / initial_investment
            
            # Get simple return metrics for comparison
            simple_metrics = self.calculate_simple_total_return(ticker, start_date, end_date)
            
            # Update metrics with reinvestment data
            simple_metrics.reinvested_value = final_value
            simple_metrics.reinvested_return = reinvested_return
            
            # Calculate annualized reinvested return
            years = (end_date - start_date).days / 365.25
            simple_metrics.cagr = (final_value / initial_investment) ** (1 / years) - 1 if years > 0 else 0
            
            return simple_metrics
            
        except Exception as e:
            self.logger.error(f"Error calculating dividend reinvested return for {ticker}: {e}")
            raise
    
    def calculate_year_over_year_returns(self, ticker: str, years: int = 5) -> pd.DataFrame:
        """
        Calculate year-over-year returns including dividends.
        
        Args:
            ticker: Stock symbol
            years: Number of years to calculate (default 5)
            
        Returns:
            DataFrame with yearly return breakdown
        """
        ticker = ticker.upper().strip()
        end_date = date.today()
        # Calculate start date by going back the specified number of years
        # Use replace() to handle leap years properly
        try:
            start_date = end_date.replace(year=end_date.year - years)
        except ValueError:
            # Handle leap year edge case (Feb 29 -> Feb 28)
            start_date = end_date.replace(year=end_date.year - years, day=28)
        
        try:
            # Get all price and dividend data
            price_data = self.cache_manager.get_cached_data(ticker, start_date, end_date)
            
            if price_data.empty:
                price_data = self.data_source.fetch_data(ticker, start_date, end_date)
                if not price_data.empty:
                    self.cache_manager.cache_data(ticker, price_data, self.data_source.name)
            
            dividend_df = self.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            # Calculate yearly returns
            yearly_returns = []
            
            for year in range(years):
                year_end = end_date - timedelta(days=year * 365)
                year_start = year_end - timedelta(days=365)
                
                # Get price data for the year
                year_prices = price_data[(price_data.index.date >= year_start) & 
                                       (price_data.index.date <= year_end)]
                
                if len(year_prices) < 2:
                    continue
                
                # Get dividends for the year
                year_dividends = dividend_df[(dividend_df['ex_date'].dt.date >= year_start) & 
                                           (dividend_df['ex_date'].dt.date <= year_end)]
                
                # Calculate returns
                initial_price = year_prices['Adj Close'].iloc[0]
                final_price = year_prices['Adj Close'].iloc[-1]
                price_return = (final_price - initial_price) / initial_price
                
                total_dividends = year_dividends['dividend_amount'].sum() if not year_dividends.empty else 0
                dividend_return = total_dividends / initial_price
                total_return = price_return + dividend_return
                
                yearly_returns.append({
                    'year': year_end.year,
                    'start_date': year_start,
                    'end_date': year_end,
                    'initial_price': initial_price,
                    'final_price': final_price,
                    'price_return': price_return,
                    'dividend_return': dividend_return,
                    'total_return': total_return,
                    'total_dividends': total_dividends,
                    'dividend_count': len(year_dividends)
                })
            
            return pd.DataFrame(yearly_returns)
            
        except Exception as e:
            self.logger.error(f"Error calculating year-over-year returns for {ticker}: {e}")
            return pd.DataFrame()
    
    def calculate_dividend_metrics(self, ticker: str, years: int = 5) -> Dict:
        """
        Calculate comprehensive dividend metrics.
        
        Args:
            ticker: Stock symbol
            years: Number of years to analyze (default 5)
            
        Returns:
            Dictionary with dividend metrics
        """
        ticker = ticker.upper().strip()
        end_date = date.today()
        # Calculate start date by going back the specified number of years
        # Use replace() to handle leap years properly
        try:
            start_date = end_date.replace(year=end_date.year - years)
        except ValueError:
            # Handle leap year edge case (Feb 29 -> Feb 28)
            start_date = end_date.replace(year=end_date.year - years, day=28)
        
        try:
            # Get dividend data
            dividend_df = self.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            if dividend_df.empty:
                return {
                    'ticker': ticker,
                    'dividend_paying': False,
                    'metrics': {}
                }
            
            # Get current price for yield calculation
            recent_prices = self.cache_manager.get_cached_data(
                ticker, 
                end_date - timedelta(days=10), 
                end_date
            )
            
            if recent_prices.empty:
                recent_prices = self.data_source.fetch_data(
                    ticker, 
                    end_date - timedelta(days=10), 
                    end_date
                )
            
            current_price = recent_prices['Adj Close'].iloc[-1] if not recent_prices.empty else None
            
            # Calculate metrics
            dividend_df['year'] = dividend_df['ex_date'].dt.year
            yearly_dividends = dividend_df.groupby('year')['dividend_amount'].agg(['sum', 'count'])
            
            # Trailing twelve months dividends
            ttm_date = end_date - timedelta(days=365)
            ttm_dividends = dividend_df[dividend_df['ex_date'].dt.date > ttm_date]['dividend_amount'].sum()
            
            # Calculate growth rate
            if len(yearly_dividends) >= 2:
                first_year_div = yearly_dividends['sum'].iloc[0]
                last_year_div = yearly_dividends['sum'].iloc[-1]
                years_diff = yearly_dividends.index[-1] - yearly_dividends.index[0]
                
                if years_diff > 0 and first_year_div > 0:
                    dividend_growth_rate = (last_year_div / first_year_div) ** (1 / years_diff) - 1
                else:
                    dividend_growth_rate = 0
            else:
                dividend_growth_rate = 0
            
            # Payment frequency
            if len(dividend_df) >= 2:
                date_diffs = dividend_df['ex_date'].diff().dt.days.dropna()
                avg_days = date_diffs.mean()
                
                if avg_days <= 35:
                    frequency = 'Monthly'
                elif avg_days <= 100:
                    frequency = 'Quarterly'
                elif avg_days <= 200:
                    frequency = 'Semi-Annual'
                else:
                    frequency = 'Annual'
            else:
                frequency = 'Unknown'
            
            metrics = {
                'ticker': ticker,
                'dividend_paying': True,
                'metrics': {
                    'total_dividends': float(dividend_df['dividend_amount'].sum()),
                    'dividend_count': len(dividend_df),
                    'ttm_dividends': float(ttm_dividends),
                    'current_yield': float(ttm_dividends / current_price) if current_price else None,
                    'average_dividend': float(dividend_df['dividend_amount'].mean()),
                    'dividend_growth_rate': float(dividend_growth_rate),
                    'payment_frequency': frequency,
                    'first_dividend_date': dividend_df['ex_date'].min().strftime('%Y-%m-%d'),
                    'last_dividend_date': dividend_df['ex_date'].max().strftime('%Y-%m-%d'),
                    'yearly_summary': yearly_dividends.to_dict()
                }
            }
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error calculating dividend metrics for {ticker}: {e}")
            return {
                'ticker': ticker,
                'error': str(e)
            }
    
    def get_dividend_calendar(self, tickers: List[str], days_ahead: int = 30) -> pd.DataFrame:
        """
        Get upcoming dividend calendar for multiple tickers.
        
        Args:
            tickers: List of stock symbols
            days_ahead: Number of days to look ahead (default 30)
            
        Returns:
            DataFrame with upcoming dividends
        """
        end_date = date.today() + timedelta(days=days_ahead)
        start_date = date.today() - timedelta(days=365)  # Get historical data to estimate future
        
        calendar_data = []
        
        for ticker in tickers:
            try:
                ticker = ticker.upper().strip()
                
                # Get dividend history
                dividend_df = self.fetch_and_cache_dividends(ticker, start_date, end_date)
                
                if dividend_df.empty:
                    continue
                
                # Get payment frequency
                metrics = self.calculate_dividend_metrics(ticker, years=2)
                frequency = metrics.get('metrics', {}).get('payment_frequency', 'Unknown')
                
                # Estimate next dividend date based on frequency
                last_dividend = dividend_df['ex_date'].max()
                
                if frequency == 'Quarterly':
                    estimated_next = last_dividend + pd.DateOffset(months=3)
                elif frequency == 'Monthly':
                    estimated_next = last_dividend + pd.DateOffset(months=1)
                elif frequency == 'Semi-Annual':
                    estimated_next = last_dividend + pd.DateOffset(months=6)
                elif frequency == 'Annual':
                    estimated_next = last_dividend + pd.DateOffset(years=1)
                else:
                    estimated_next = None
                
                # Add to calendar
                if estimated_next and estimated_next.date() <= end_date:
                    calendar_data.append({
                        'ticker': ticker,
                        'estimated_ex_date': estimated_next,
                        'last_dividend_amount': dividend_df['dividend_amount'].iloc[0],
                        'payment_frequency': frequency,
                        'last_ex_date': last_dividend,
                        'confidence': 'Estimated'
                    })
                
            except Exception as e:
                self.logger.error(f"Error processing dividend calendar for {ticker}: {e}")
                continue
        
        if calendar_data:
            calendar_df = pd.DataFrame(calendar_data)
            calendar_df = calendar_df.sort_values('estimated_ex_date')
            return calendar_df
        else:
            return pd.DataFrame()
    
    def export_results(self, metrics: Union[TotalReturnMetrics, Dict, pd.DataFrame], 
                      format: str = 'json') -> Union[str, pd.DataFrame]:
        """
        Export calculation results in various formats.
        
        Args:
            metrics: Calculation results (TotalReturnMetrics, dict, or DataFrame)
            format: Output format ('json', 'dataframe', 'dict')
            
        Returns:
            Formatted results
        """
        if format == 'json':
            if isinstance(metrics, TotalReturnMetrics):
                data = asdict(metrics)
                # Convert dates to strings
                data['start_date'] = data['start_date'].isoformat()
                data['end_date'] = data['end_date'].isoformat()
                return json.dumps(data, indent=2)
            elif isinstance(metrics, pd.DataFrame):
                return metrics.to_json(orient='records', indent=2, date_format='iso')
            else:
                return json.dumps(metrics, indent=2, default=str)
        
        elif format == 'dataframe':
            if isinstance(metrics, TotalReturnMetrics):
                return pd.DataFrame([asdict(metrics)])
            elif isinstance(metrics, dict):
                return pd.DataFrame([metrics])
            else:
                return metrics
        
        elif format == 'dict':
            if isinstance(metrics, TotalReturnMetrics):
                return asdict(metrics)
            elif isinstance(metrics, pd.DataFrame):
                return metrics.to_dict('records')
            else:
                return metrics
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    def get_cache_stats(self) -> Dict:
        """Get statistics about cached dividend data"""
        try:
            with self.get_connection() as conn:
                # Count total dividends
                cursor = conn.execute("SELECT COUNT(*) as count FROM dividends")
                total_dividends = cursor.fetchone()['count']
                
                # Count tickers with dividends
                cursor = conn.execute("SELECT COUNT(DISTINCT ticker_symbol) as count FROM dividends")
                total_tickers = cursor.fetchone()['count']
                
                # Get date range
                cursor = conn.execute("SELECT MIN(ex_date) as min_date, MAX(ex_date) as max_date FROM dividends")
                row = cursor.fetchone()
                
                # Get cache ranges
                cursor = conn.execute("SELECT COUNT(*) as count FROM dividend_cache_ranges")
                cache_ranges = cursor.fetchone()['count']
                
                return {
                    'total_dividend_records': total_dividends,
                    'tickers_with_dividends': total_tickers,
                    'earliest_dividend': row['min_date'],
                    'latest_dividend': row['max_date'],
                    'cache_ranges': cache_ranges
                }
                
        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return {}
    
    def close(self):
        """Clean up resources"""
        if hasattr(self, 'cache_manager'):
            self.cache_manager.close()
        if hasattr(self, 'data_source'):
            self.data_source.close()
        self.logger.info("Total Return Calculator closed")


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Initialize calculator
    calculator = TotalReturnCalculator()
    
    # Example 1: Simple total return
    print("\n=== Simple Total Return ===")
    metrics = calculator.calculate_simple_total_return('AAPL', '2023-01-01', '2024-01-01')
    print(calculator.export_results(metrics, format='json'))
    
    # Example 2: Dividend reinvested return
    print("\n=== Dividend Reinvested Return ===")
    reinvest_metrics = calculator.calculate_dividend_reinvested_return('AAPL', '2023-01-01', '2024-01-01')
    print(f"Simple Return: {reinvest_metrics.total_return:.2%}")
    print(f"Reinvested Return: {reinvest_metrics.reinvested_return:.2%}")
    
    # Example 3: Year-over-year returns
    print("\n=== Year-over-Year Returns ===")
    yoy_returns = calculator.calculate_year_over_year_returns('AAPL', years=3)
    print(yoy_returns.to_string())
    
    # Example 4: Dividend metrics
    print("\n=== Dividend Metrics ===")
    div_metrics = calculator.calculate_dividend_metrics('AAPL', years=5)
    print(json.dumps(div_metrics, indent=2, default=str))
    
    # Example 5: Dividend calendar
    print("\n=== Dividend Calendar ===")
    calendar = calculator.get_dividend_calendar(['AAPL', 'MSFT', 'JNJ'], days_ahead=90)
    print(calendar.to_string())
    
    # Clean up
    calculator.close()