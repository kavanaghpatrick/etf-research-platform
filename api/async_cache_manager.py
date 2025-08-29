"""
Async cache manager for ETF Research Platform.
Provides async wrappers for database operations with thread-safety and retry logic.
Designed for migration from SQLite to Vercel Postgres.
"""

import os
import asyncio
import logging
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import pandas as pd
from contextlib import asynccontextmanager
import aiosqlite
import json
from functools import wraps
import time

from market_calendar_service import get_market_calendar


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
        total_days = (self.end_date - self.start_date).days + 1
        return int(total_days * 5 / 7)


def async_retry(max_attempts: int = 3, delay: float = 0.1, backoff: float = 2.0):
    """Decorator for retrying async operations with exponential backoff."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            current_delay = delay
            
            for attempt in range(max_attempts):
                try:
                    return await func(*args, **kwargs)
                except (asyncio.TimeoutError, aiosqlite.DatabaseError) as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        raise
                except Exception as e:
                    # Don't retry other exceptions
                    raise
            
            raise last_exception
        return wrapper
    return decorator


class AsyncCacheManager:
    """
    Async cache manager for stock data with intelligent gap detection
    and API optimization strategies. Designed for serverless environments.
    """
    
    def __init__(self, database_url: str = None, exchange: str = 'NYSE'):
        self.logger = logging.getLogger(__name__)
        self.database_url = database_url or self._get_database_url()
        self.db_path = self._extract_db_path()
        self._lock = asyncio.Lock()
        self._write_lock = asyncio.Lock()  # Separate lock for write operations
        self.market_calendar = get_market_calendar(exchange)
        self._connection_pool = []
        self._pool_size = 5
        self._is_initialized = False
        
        self.logger.info(f"Initialized async cache manager with database: {self.db_path}")
    
    def _get_database_url(self) -> str:
        """Get database URL from environment."""
        # Check for Vercel Postgres URL first
        vercel_url = os.getenv('POSTGRES_URL_POOLING')
        if vercel_url:
            self.logger.info("Using Vercel Postgres URL")
            return vercel_url
            
        return os.getenv('DATABASE_URL', 'sqlite:///data/etf_platform.db')
    
    def _extract_db_path(self) -> str:
        """Extract file path from SQLite URL."""
        if self.database_url.startswith('postgres'):
            # PostgreSQL URL - return as is for future implementation
            return self.database_url
            
        if self.database_url.startswith('sqlite:///'):
            return self.database_url[10:]
        elif self.database_url.startswith('sqlite://'):
            return self.database_url[9:]
        else:
            return self.database_url
    
    async def _initialize_database(self):
        """Initialize database schema if needed."""
        if self._is_initialized:
            return
            
        async with self._write_lock:
            if self._is_initialized:
                return
                
            try:
                # Ensure directory exists
                if not self.database_url.startswith('postgres'):
                    os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
                
                async with self.get_connection() as conn:
                    # Create tables if they don't exist
                    await conn.executescript("""
                        CREATE TABLE IF NOT EXISTS tickers (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            symbol VARCHAR(10) UNIQUE NOT NULL,
                            name VARCHAR(255),
                            total_records INTEGER DEFAULT 0,
                            first_cached_date DATE,
                            last_cached_date DATE,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                        
                        CREATE TABLE IF NOT EXISTS stock_data (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            ticker_symbol VARCHAR(10) NOT NULL,
                            date DATE NOT NULL,
                            open DECIMAL(12,4) NOT NULL,
                            high DECIMAL(12,4) NOT NULL,
                            low DECIMAL(12,4) NOT NULL,
                            close DECIMAL(12,4) NOT NULL,
                            volume BIGINT NOT NULL,
                            adj_close DECIMAL(12,4) NOT NULL,
                            source VARCHAR(50) NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(ticker_symbol, date)
                        );
                        
                        CREATE TABLE IF NOT EXISTS cache_ranges (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            ticker_symbol VARCHAR(10) NOT NULL,
                            start_date DATE NOT NULL,
                            end_date DATE NOT NULL,
                            source VARCHAR(50) NOT NULL,
                            record_count INTEGER NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        );
                        
                        CREATE TABLE IF NOT EXISTS api_usage (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            source VARCHAR(50) NOT NULL,
                            endpoint VARCHAR(255),
                            ticker_symbol VARCHAR(10),
                            request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            response_status INTEGER,
                            records_returned INTEGER DEFAULT 0
                        );
                        
                        CREATE INDEX IF NOT EXISTS idx_stock_data_ticker_date ON stock_data(ticker_symbol, date);
                        CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data(date);
                        CREATE INDEX IF NOT EXISTS idx_cache_ranges_ticker ON cache_ranges(ticker_symbol);
                        CREATE INDEX IF NOT EXISTS idx_api_usage_source_timestamp ON api_usage(source, request_timestamp);
                    """)
                    
                    await conn.commit()
                    
                self._is_initialized = True
                self.logger.info("Database schema initialized successfully")
                
            except Exception as e:
                self.logger.error(f"Failed to initialize database: {e}")
                raise
    
    @asynccontextmanager
    async def get_connection(self):
        """Async context manager for database connections."""
        # For now, using SQLite - will be replaced with Postgres
        if not self.database_url.startswith('postgres'):
            async with aiosqlite.connect(self.db_path) as conn:
                conn.row_factory = aiosqlite.Row
                yield conn
        else:
            # Stub for future Vercel Postgres implementation
            yield await self._get_postgres_connection()
    
    async def _get_postgres_connection(self):
        """Stub for future Vercel Postgres connection."""
        # This will be implemented when migrating to Vercel Postgres
        raise NotImplementedError("Postgres support coming soon")
    
    @async_retry(max_attempts=3, delay=0.1)
    async def get_cached_data_async(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        """
        Retrieve cached data for a ticker within the specified date range.
        Returns empty DataFrame if no data found.
        """
        await self._initialize_database()
        
        try:
            async with self.get_connection() as conn:
                query = """
                    SELECT date, open, high, low, close, volume, adj_close, source
                    FROM stock_data 
                    WHERE ticker_symbol = ? 
                    AND date >= ? 
                    AND date <= ?
                    ORDER BY date ASC
                """
                
                async with conn.execute(query, (ticker, start_date.isoformat(), end_date.isoformat())) as cursor:
                    rows = await cursor.fetchall()
                
                if not rows:
                    return pd.DataFrame()
                
                # Convert to DataFrame
                data = [dict(row) for row in rows]
                df = pd.DataFrame(data)
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
    
    @async_retry(max_attempts=3, delay=0.1)
    async def cache_data_async(self, ticker: str, data: pd.DataFrame, source: str) -> bool:
        """
        Cache fetched data with efficient bulk operations.
        Uses write serialization for SQLite compatibility.
        Returns True if successful, False otherwise.
        """
        if data.empty:
            return True
        
        await self._initialize_database()
        
        try:
            # Serialize writes for SQLite
            async with self._write_lock:
                async with self.get_connection() as conn:
                    # Ensure ticker exists in tickers table
                    await conn.execute(
                        "INSERT OR IGNORE INTO tickers (symbol) VALUES (?)",
                        (ticker,)
                    )
                    
                    # Prepare data for insertion
                    insert_data = []
                    for idx, row in data.iterrows():
                        insert_data.append((
                            ticker,
                            idx.date().isoformat(),
                            float(row['Open']),
                            float(row['High']),
                            float(row['Low']),
                            float(row['Close']),
                            int(row['Volume']),
                            float(row.get('Adj Close', row['Close'])),
                            source
                        ))
                    
                    # Bulk insert with conflict resolution
                    await conn.executemany("""
                        INSERT OR REPLACE INTO stock_data 
                        (ticker_symbol, date, open, high, low, close, volume, adj_close, source)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, insert_data)
                    
                    # Record cache range metadata
                    start_date = data.index.min().date()
                    end_date = data.index.max().date()
                    
                    await conn.execute("""
                        INSERT INTO cache_ranges 
                        (ticker_symbol, start_date, end_date, source, record_count)
                        VALUES (?, ?, ?, ?, ?)
                    """, (ticker, start_date.isoformat(), end_date.isoformat(), source, len(data)))
                    
                    # Update ticker metadata
                    await conn.execute("""
                        UPDATE tickers SET
                            total_records = (
                                SELECT COUNT(*) FROM stock_data 
                                WHERE ticker_symbol = ?
                            ),
                            first_cached_date = (
                                SELECT MIN(date) FROM stock_data 
                                WHERE ticker_symbol = ?
                            ),
                            last_cached_date = (
                                SELECT MAX(date) FROM stock_data 
                                WHERE ticker_symbol = ?
                            ),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE symbol = ?
                    """, (ticker, ticker, ticker, ticker))
                    
                    await conn.commit()
                    
                    self.logger.info(f"Cached {len(data)} records for {ticker} from {source}")
                    return True
                    
        except Exception as e:
            self.logger.error(f"Error caching data for {ticker}: {e}")
            return False
    
    @async_retry(max_attempts=3, delay=0.1)
    async def get_missing_ranges_async(self, ticker: str, start_date: date, end_date: date) -> List[DateRange]:
        """
        Identify missing date ranges that need to be fetched from APIs.
        Uses market calendar to only consider actual trading days.
        """
        await self._initialize_database()
        
        try:
            async with self.get_connection() as conn:
                # Get all cached dates for this ticker in the range
                query = """
                    SELECT date 
                    FROM stock_data 
                    WHERE ticker_symbol = ? 
                    AND date >= ? 
                    AND date <= ?
                    ORDER BY date ASC
                """
                
                async with conn.execute(query, (ticker, start_date.isoformat(), end_date.isoformat())) as cursor:
                    rows = await cursor.fetchall()
                    cached_dates = {datetime.strptime(row['date'], '%Y-%m-%d').date() for row in rows}
                
                # Get valid trading days from market calendar
                valid_trading_days = self.market_calendar.get_valid_trading_days(start_date, end_date)
                trading_days = [pd.Timestamp(day).date() for day in valid_trading_days]
                
                # Find missing date ranges
                missing_ranges = []
                range_start = None
                
                for trading_day in trading_days:
                    if trading_day not in cached_dates:
                        if range_start is None:
                            range_start = trading_day
                    else:
                        if range_start is not None:
                            # End of missing range
                            missing_ranges.append(DateRange(range_start, trading_day - timedelta(days=1)))
                            range_start = None
                
                # Handle case where missing range extends to the end
                if range_start is not None:
                    missing_ranges.append(DateRange(range_start, end_date))
                
                # Calculate actual trading days missing
                total_missing_days = 0
                for r in missing_ranges:
                    total_missing_days += self.market_calendar.estimate_trading_days_count(r.start_date, r.end_date)
                
                if missing_ranges:
                    self.logger.info(f"Found {len(missing_ranges)} missing ranges for {ticker} ({total_missing_days} trading days)")
                else:
                    self.logger.debug(f"No missing ranges for {ticker} in requested period")
                
                return missing_ranges
                
        except Exception as e:
            self.logger.error(f"Error detecting missing ranges for {ticker}: {e}")
            # Fallback: assume everything is missing
            return [DateRange(start_date, end_date)]
    
    async def batch_cache_data_async(self, operations: List[Tuple[str, pd.DataFrame, str]]) -> Dict[str, bool]:
        """
        Batch cache multiple ticker data operations.
        Returns dict mapping ticker to success status.
        """
        results = {}
        
        # Process operations with limited concurrency to avoid overwhelming the database
        semaphore = asyncio.Semaphore(3)  # Limit to 3 concurrent operations
        
        async def cache_with_semaphore(ticker: str, data: pd.DataFrame, source: str):
            async with semaphore:
                success = await self.cache_data_async(ticker, data, source)
                return ticker, success
        
        # Create tasks for all operations
        tasks = [
            cache_with_semaphore(ticker, data, source)
            for ticker, data, source in operations
        ]
        
        # Execute and collect results
        completed = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in completed:
            if isinstance(result, Exception):
                self.logger.error(f"Batch operation failed: {result}")
                # Extract ticker from the exception context if possible
                continue
            ticker, success = result
            results[ticker] = success
        
        successful = sum(1 for s in results.values() if s)
        self.logger.info(f"Batch cached {successful}/{len(operations)} tickers successfully")
        
        return results
    
    async def get_cache_stats_async(self, ticker: str = None) -> List[CacheStats]:
        """Get comprehensive cache statistics asynchronously."""
        await self._initialize_database()
        
        try:
            async with self.get_connection() as conn:
                if ticker:
                    query = """
                        SELECT 
                            symbol,
                            name,
                            total_records,
                            first_cached_date,
                            last_cached_date,
                            (SELECT COUNT(*) FROM cache_ranges WHERE ticker_symbol = symbol) as cached_ranges
                        FROM tickers 
                        WHERE symbol = ?
                    """
                    cursor = await conn.execute(query, (ticker,))
                else:
                    query = """
                        SELECT 
                            symbol,
                            name,
                            total_records,
                            first_cached_date,
                            last_cached_date,
                            (SELECT COUNT(*) FROM cache_ranges WHERE ticker_symbol = symbol) as cached_ranges
                        FROM tickers 
                        ORDER BY total_records DESC
                    """
                    cursor = await conn.execute(query)
                
                rows = await cursor.fetchall()
                stats = []
                
                for row in rows:
                    # Calculate freshness status
                    if row['last_cached_date']:
                        last_date = datetime.strptime(row['last_cached_date'], '%Y-%m-%d').date()
                        days_old = (date.today() - last_date).days
                        if days_old <= 1:
                            freshness = 'Current'
                        elif days_old <= 7:
                            freshness = 'Recent'
                        else:
                            freshness = 'Stale'
                    else:
                        freshness = 'Unknown'
                    
                    stats.append(CacheStats(
                        ticker=row['symbol'],
                        total_records=row['total_records'] or 0,
                        first_date=datetime.strptime(row['first_cached_date'], '%Y-%m-%d').date() if row['first_cached_date'] else None,
                        last_date=datetime.strptime(row['last_cached_date'], '%Y-%m-%d').date() if row['last_cached_date'] else None,
                        cached_ranges=row['cached_ranges'] or 0,
                        coverage_percentage=await self._calculate_coverage_async(row['symbol'], conn),
                        freshness_status=freshness
                    ))
                
                return stats
                
        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return []
    
    async def _calculate_coverage_async(self, ticker: str, conn) -> float:
        """Calculate cache coverage percentage for recent trading days."""
        try:
            # Calculate coverage for last 252 trading days (1 year)
            end_date = date.today()
            start_date = end_date - timedelta(days=365)
            
            # Count cached business days
            cursor = await conn.execute("""
                SELECT COUNT(*) as cached_days
                FROM stock_data 
                WHERE ticker_symbol = ? 
                AND date >= ? 
                AND date <= ?
                AND CAST(strftime('%w', date) AS INTEGER) NOT IN (0, 6)
            """, (ticker, start_date.isoformat(), end_date.isoformat()))
            
            row = await cursor.fetchone()
            cached_days = row['cached_days']
            
            # Approximate business days in a year
            total_business_days = 252
            
            return min(100.0, (cached_days / total_business_days) * 100)
            
        except Exception as e:
            self.logger.error(f"Error calculating coverage for {ticker}: {e}")
            return 0.0
    
    async def optimize_api_usage_async(self, ticker: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Analyze cache and provide API optimization recommendations.
        """
        missing_ranges = await self.get_missing_ranges_async(ticker, start_date, end_date)
        cache_stats = await self.get_cache_stats_async(ticker)
        
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
    
    # Future Vercel Postgres support stubs
    async def _init_vercel_postgres(self):
        """Initialize Vercel Postgres connection pool."""
        # Will be implemented when migrating to Vercel Postgres
        # This will use @vercel/postgres SDK or asyncpg
        pass
    
    async def _get_vercel_postgres_pool(self):
        """Get connection from Vercel Postgres pool."""
        # Will implement connection pooling optimized for serverless
        pass
    
    async def _migrate_to_postgres(self):
        """Migrate data from SQLite to Vercel Postgres."""
        # Will implement data migration logic
        pass
    
    async def close(self):
        """Clean up database connections and resources."""
        # Close any open connections in the pool
        for conn in self._connection_pool:
            try:
                await conn.close()
            except:
                pass
        
        self._connection_pool.clear()
        self.logger.info("Async cache manager closed")


# Convenience functions for backward compatibility
async def create_async_cache_manager(database_url: str = None, exchange: str = 'NYSE') -> AsyncCacheManager:
    """Factory function to create and initialize an async cache manager."""
    manager = AsyncCacheManager(database_url, exchange)
    await manager._initialize_database()
    return manager