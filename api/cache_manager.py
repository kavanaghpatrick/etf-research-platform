"""
Sophisticated Stock Data Cache Manager with PostgreSQL + TimescaleDB backend.
Handles intelligent caching, gap detection, and API optimization.
"""

import os
import logging
import asyncio
import pandas as pd
import psycopg2
import psycopg2.pool
import psycopg2.extras
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from contextlib import contextmanager
import numpy as np


@dataclass
class CacheStats:
    """Statistics about cache coverage for a ticker."""
    ticker: str
    total_records: int
    first_date: Optional[date]
    last_date: Optional[date]
    cached_ranges: int
    coverage_percentage: float
    freshness_status: str


@dataclass
class DateRange:
    """Represents a date range that needs to be fetched."""
    start_date: date
    end_date: date
    
    @property
    def business_days(self) -> int:
        """Calculate number of business days in range."""
        # Simple approximation: 5/7 of total days
        total_days = (self.end_date - self.start_date).days + 1
        return int(total_days * 5 / 7)


class StockDataCache:
    """
    Sophisticated cache manager for stock data with intelligent gap detection
    and API optimization strategies.
    """
    
    def __init__(self, database_url: str = None, pool_size: int = 20):
        self.logger = logging.getLogger(__name__)
        self.database_url = database_url or self._get_database_url()
        self.pool = None
        self.pool_size = pool_size
        self._initialize_connection_pool()
    
    def _get_database_url(self) -> str:
        """Get database URL from environment or use default."""
        return os.getenv(
            'DATABASE_URL', 
            'postgresql://localhost:5432/etf_platform'
        )
    
    def _initialize_connection_pool(self):
        """Initialize PostgreSQL connection pool."""
        try:
            self.pool = psycopg2.pool.ThreadedConnectionPool(
                1, self.pool_size,
                self.database_url,
                cursor_factory=psycopg2.extras.RealDictCursor
            )
            self.logger.info(f"Initialized connection pool with {self.pool_size} connections")
        except Exception as e:
            self.logger.error(f"Failed to initialize database pool: {e}")
            # Fallback to in-memory cache for development
            self._memory_cache = {}
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        if self.pool:
            conn = self.pool.getconn()
            try:
                yield conn
            finally:
                self.pool.putconn(conn)
        else:
            # Fallback for development without database
            yield None
    
    def get_cached_data(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        """
        Retrieve cached data for a ticker within the specified date range.
        Returns empty DataFrame if no data found.
        """
        try:
            with self.get_connection() as conn:
                if conn is None:
                    return pd.DataFrame()
                
                cursor = conn.cursor()
                query = """
                    SELECT date, open, high, low, close, volume, adj_close, source
                    FROM stock_data 
                    WHERE ticker_symbol = %s 
                    AND date >= %s 
                    AND date <= %s
                    ORDER BY date ASC
                """
                
                cursor.execute(query, (ticker, start_date, end_date))
                rows = cursor.fetchall()
                
                if not rows:
                    return pd.DataFrame()
                
                # Convert to DataFrame
                df = pd.DataFrame([dict(row) for row in rows])
                df['Date'] = pd.to_datetime(df['date'])
                df.set_index('Date', inplace=True)
                df.drop('date', axis=1, inplace=True)
                
                # Rename columns to match API format
                df.columns = ['Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close', 'Source']
                
                self.logger.info(f"Retrieved {len(df)} cached records for {ticker}")
                return df
                
        except Exception as e:
            self.logger.error(f"Error retrieving cached data for {ticker}: {e}")
            return pd.DataFrame()
    
    def get_missing_ranges(self, ticker: str, start_date: date, end_date: date) -> List[DateRange]:
        """
        Identify missing date ranges that need to be fetched from APIs.
        Uses intelligent gap detection to minimize API calls.
        """
        try:
            with self.get_connection() as conn:
                if conn is None:
                    # Fallback: assume everything is missing
                    return [DateRange(start_date, end_date)]
                
                cursor = conn.cursor()
                
                # Get all cached dates for this ticker in the range
                query = """
                    SELECT date 
                    FROM stock_data 
                    WHERE ticker_symbol = %s 
                    AND date >= %s 
                    AND date <= %s
                    ORDER BY date ASC
                """
                
                cursor.execute(query, (ticker, start_date, end_date))
                cached_dates = {row['date'] for row in cursor.fetchall()}
                
                # Generate business days in the requested range
                business_days = []
                current = start_date
                while current <= end_date:
                    # Skip weekends (0=Sunday, 6=Saturday)
                    if current.weekday() < 5:  # Monday=0, Friday=4
                        business_days.append(current)
                    current += timedelta(days=1)
                
                # Find missing date ranges
                missing_ranges = []
                range_start = None
                
                for business_day in business_days:
                    if business_day not in cached_dates:
                        if range_start is None:
                            range_start = business_day
                    else:
                        if range_start is not None:
                            # End of missing range
                            missing_ranges.append(DateRange(range_start, business_day - timedelta(days=1)))
                            range_start = None
                
                # Handle case where missing range extends to the end
                if range_start is not None:
                    missing_ranges.append(DateRange(range_start, end_date))
                
                total_missing_days = sum(r.business_days for r in missing_ranges)
                self.logger.info(f"Found {len(missing_ranges)} missing ranges for {ticker} ({total_missing_days} business days)")
                
                return missing_ranges
                
        except Exception as e:
            self.logger.error(f"Error detecting missing ranges for {ticker}: {e}")
            # Fallback: assume everything is missing
            return [DateRange(start_date, end_date)]
    
    def cache_data(self, ticker: str, data: pd.DataFrame, source: str) -> bool:
        """
        Cache fetched data with efficient bulk operations.
        Returns True if successful, False otherwise.
        """
        if data.empty:
            return True
        
        try:
            with self.get_connection() as conn:
                if conn is None:
                    # Store in memory cache for development
                    key = f"{ticker}_{source}"
                    if not hasattr(self, '_memory_cache'):
                        self._memory_cache = {}
                    self._memory_cache[key] = data
                    return True
                
                cursor = conn.cursor()
                
                # Ensure ticker exists in tickers table
                cursor.execute(
                    "INSERT INTO tickers (symbol) VALUES (%s) ON CONFLICT (symbol) DO NOTHING",
                    (ticker,)
                )
                
                # Prepare bulk insert data
                insert_data = []
                for idx, row in data.iterrows():
                    insert_data.append((
                        ticker,
                        idx.date(),  # Convert pandas timestamp to date
                        float(row['Open']),
                        float(row['High']),
                        float(row['Low']),
                        float(row['Close']),
                        int(row['Volume']),
                        float(row['Adj Close']),
                        source
                    ))
                
                # Bulk insert with conflict resolution
                insert_query = """
                    INSERT INTO stock_data 
                    (ticker_symbol, date, open, high, low, close, volume, adj_close, source)
                    VALUES %s
                    ON CONFLICT (ticker_symbol, date) DO UPDATE SET
                        open = EXCLUDED.open,
                        high = EXCLUDED.high,
                        low = EXCLUDED.low,
                        close = EXCLUDED.close,
                        volume = EXCLUDED.volume,
                        adj_close = EXCLUDED.adj_close,
                        source = EXCLUDED.source,
                        created_at = NOW()
                """
                
                psycopg2.extras.execute_values(
                    cursor, insert_query, insert_data,
                    template=None, page_size=1000
                )
                
                # Record cache range metadata
                start_date = data.index.min().date()
                end_date = data.index.max().date()
                
                cursor.execute("""
                    INSERT INTO cache_ranges 
                    (ticker_symbol, start_date, end_date, source, record_count)
                    VALUES (%s, %s, %s, %s, %s)
                """, (ticker, start_date, end_date, source, len(data)))
                
                conn.commit()
                
                self.logger.info(f"Cached {len(data)} records for {ticker} from {source}")
                return True
                
        except Exception as e:
            self.logger.error(f"Error caching data for {ticker}: {e}")
            return False
    
    def get_cache_stats(self, ticker: str = None) -> List[CacheStats]:
        """Get comprehensive cache statistics."""
        try:
            with self.get_connection() as conn:
                if conn is None:
                    return []
                
                cursor = conn.cursor()
                
                if ticker:
                    query = "SELECT * FROM cache_stats WHERE symbol = %s"
                    cursor.execute(query, (ticker,))
                else:
                    query = "SELECT * FROM cache_stats ORDER BY total_records DESC"
                    cursor.execute(query)
                
                stats = []
                for row in cursor.fetchall():
                    stats.append(CacheStats(
                        ticker=row['symbol'],
                        total_records=row['total_records'] or 0,
                        first_date=row['first_cached_date'],
                        last_date=row['last_cached_date'],
                        cached_ranges=row['cached_ranges'] or 0,
                        coverage_percentage=self._calculate_coverage(row['symbol']),
                        freshness_status=row['freshness_status'] or 'Unknown'
                    ))
                
                return stats
                
        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return []
    
    def _calculate_coverage(self, ticker: str) -> float:
        """Calculate cache coverage percentage for recent trading days."""
        try:
            with self.get_connection() as conn:
                if conn is None:
                    return 0.0
                
                cursor = conn.cursor()
                
                # Calculate coverage for last 252 trading days (1 year)
                end_date = date.today()
                start_date = end_date - timedelta(days=365)
                
                # Count cached business days
                cursor.execute("""
                    SELECT COUNT(*) as cached_days
                    FROM stock_data 
                    WHERE ticker_symbol = %s 
                    AND date >= %s 
                    AND date <= %s
                    AND EXTRACT(DOW FROM date) NOT IN (0, 6)
                """, (ticker, start_date, end_date))
                
                cached_days = cursor.fetchone()['cached_days']
                
                # Approximate business days in a year
                total_business_days = 252
                
                return min(100.0, (cached_days / total_business_days) * 100)
                
        except Exception as e:
            self.logger.error(f"Error calculating coverage for {ticker}: {e}")
            return 0.0
    
    def optimize_api_usage(self, ticker: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Analyze cache and provide API optimization recommendations.
        """
        missing_ranges = self.get_missing_ranges(ticker, start_date, end_date)
        cache_stats = self.get_cache_stats(ticker)
        
        total_missing_days = sum(r.business_days for r in missing_ranges)
        total_requested_days = len(pd.bdate_range(start_date, end_date))
        
        return {
            'ticker': ticker,
            'requested_range': {'start': start_date, 'end': end_date},
            'total_requested_days': total_requested_days,
            'missing_ranges': len(missing_ranges),
            'missing_days': total_missing_days,
            'cache_hit_rate': (total_requested_days - total_missing_days) / total_requested_days if total_requested_days > 0 else 0,
            'api_calls_needed': len(missing_ranges),
            'cache_stats': cache_stats[0] if cache_stats else None,
            'recommendations': self._get_optimization_recommendations(missing_ranges, cache_stats)
        }
    
    def _get_optimization_recommendations(self, missing_ranges: List[DateRange], cache_stats: List[CacheStats]) -> List[str]:
        """Generate optimization recommendations."""
        recommendations = []
        
        if not missing_ranges:
            recommendations.append("✅ All data available in cache - no API calls needed")
        else:
            total_missing = sum(r.business_days for r in missing_ranges)
            if total_missing > 100:
                recommendations.append("⚠️ Large amount of missing data - consider background cache warming")
            
            if len(missing_ranges) > 5:
                recommendations.append("💡 Multiple small gaps - batch API calls for efficiency")
        
        if cache_stats and cache_stats[0].coverage_percentage < 50:
            recommendations.append("📈 Low cache coverage - prime candidate for background fetching")
        
        return recommendations
    
    def close(self):
        """Clean up database connections."""
        if self.pool:
            self.pool.closeall()
            self.logger.info("Closed database connection pool")