"""
SQLite-compatible cache manager for local development.
Provides the same interface as the PostgreSQL cache manager but uses SQLite.
"""

import os
import sqlite3
import logging
import pandas as pd
import time
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from contextlib import contextmanager
import threading
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


class SQLiteStockDataCache:
    """
    SQLite-compatible cache manager for local development.
    Provides same interface as PostgreSQL version but uses SQLite.
    """
    
    def __init__(self, database_url: str = None, exchange: str = 'NYSE'):
        self.logger = logging.getLogger(__name__)
        self.database_url = database_url or self._get_database_url()
        self.db_path = self._extract_db_path()
        self._lock = threading.Lock()
        self.market_calendar = get_market_calendar(exchange)
        
        # Cache for gap detection results to avoid repeated expensive calculations
        self._gap_detection_cache = {}
        self._gap_cache_ttl = 3600  # 1 hour TTL for gap detection cache
        
        # Ensure database and tables exist
        self._initialize_database()
        
        self.logger.info(f"Initialized SQLite cache with database: {self.db_path}")
    
    def _get_database_url(self) -> str:
        """Get database URL from environment."""
        return os.getenv('DATABASE_URL', 'sqlite:///data/etf_platform.db')
    
    def _extract_db_path(self) -> str:
        """Extract file path from SQLite URL."""
        if self.database_url.startswith('sqlite:///'):
            return self.database_url[10:]  # Remove 'sqlite:///'
        elif self.database_url.startswith('sqlite://'):
            return self.database_url[9:]   # Remove 'sqlite://'
        else:
            return self.database_url
    
    def _initialize_database(self):
        """Create database tables if they don't exist."""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            
            with self.get_connection() as conn:
                # Create tickers table
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS tickers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        symbol VARCHAR(10) UNIQUE NOT NULL,
                        name VARCHAR(255),
                        total_records INTEGER DEFAULT 0,
                        first_cached_date DATE,
                        last_cached_date DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create stock_data table (main time series data)
                conn.execute("""
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
                    )
                """)
                
                # Create cache_ranges table (track cached date ranges)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS cache_ranges (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        source VARCHAR(50) NOT NULL,
                        record_count INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create api_usage table (track API usage)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS api_usage (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        source VARCHAR(50) NOT NULL,
                        endpoint VARCHAR(255),
                        ticker_symbol VARCHAR(10),
                        request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        response_status INTEGER,
                        records_returned INTEGER DEFAULT 0
                    )
                """)
                
                # Create dividends table (for dividend gap detection)
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
                        frequency INTEGER DEFAULT 4,
                        source VARCHAR(50) NOT NULL,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker_symbol, ex_date)
                    )
                """)
                
                # Create dividend_cache_ranges table (track dividend cache coverage)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS dividend_cache_ranges (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        source VARCHAR(50) NOT NULL,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker_symbol, start_date, end_date, source)
                    )
                """)
                
                # Create corporate_actions table (for stock splits, etc.)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS corporate_actions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ticker_symbol VARCHAR(10) NOT NULL,
                        action_date DATE NOT NULL,
                        action_type VARCHAR(20) NOT NULL,
                        split_ratio DECIMAL(10,4),
                        description TEXT,
                        source VARCHAR(50) NOT NULL,
                        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(ticker_symbol, action_date, action_type)
                    )
                """)
                
                # Create inflation_data table (for Monte Carlo simulations)
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS inflation_data (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        date DATE NOT NULL,
                        cpi_rate DECIMAL(8,4) NOT NULL,
                        source VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(date, source)
                    )
                """)
                
                # Create indexes for performance
                conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_data_ticker_date ON stock_data(ticker_symbol, date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data(date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_ranges_ticker ON cache_ranges(ticker_symbol)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_api_usage_source_timestamp ON api_usage(source, request_timestamp)")
                
                # Create dividend-specific indexes
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends(ticker_symbol)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividends_ticker_date ON dividends(ticker_symbol, ex_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividend_cache_ranges_ticker ON dividend_cache_ranges(ticker_symbol)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_dividend_cache_ranges_dates ON dividend_cache_ranges(start_date, end_date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_corporate_actions_ticker ON corporate_actions(ticker_symbol)")
                
                # Create inflation data indexes
                conn.execute("CREATE INDEX IF NOT EXISTS idx_inflation_data_date ON inflation_data(date)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_inflation_data_source ON inflation_data(source)")
                
                # Migrate existing database schemas if needed
                self._migrate_schema(conn)
                
                conn.commit()
                self.logger.info("Database schema initialized successfully with dividend tables")
                
        except Exception as e:
            self.logger.error(f"Failed to initialize database: {e}")
            raise
    
    def _migrate_schema(self, conn):
        """Migrate existing database schema to add missing columns"""
        try:
            # Check if frequency column exists in dividends table
            cursor = conn.execute("PRAGMA table_info(dividends)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'frequency' not in columns:
                self.logger.info("Adding frequency column to dividends table")
                conn.execute("ALTER TABLE dividends ADD COLUMN frequency INTEGER DEFAULT 4")
            
            if 'adjustment_factor' not in columns:
                self.logger.info("Adding adjustment_factor column to dividends table")
                conn.execute("ALTER TABLE dividends ADD COLUMN adjustment_factor DECIMAL(8,4) DEFAULT 1.0")
            
            # Check if last_updated column exists in dividend_cache_ranges table
            cursor = conn.execute("PRAGMA table_info(dividend_cache_ranges)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if 'last_updated' not in columns:
                self.logger.info("Adding last_updated column to dividend_cache_ranges table")
                # SQLite doesn't support CURRENT_TIMESTAMP as default in ALTER TABLE
                conn.execute("ALTER TABLE dividend_cache_ranges ADD COLUMN last_updated TIMESTAMP DEFAULT '2023-01-01 00:00:00'")
                
        except Exception as e:
            self.logger.warning(f"Schema migration encountered an issue: {e}")
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        with self._lock:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row  # Enable dict-like access
            try:
                yield conn
            finally:
                conn.close()
    
    def get_cached_data(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        """
        Retrieve cached data for a ticker within the specified date range.
        Returns empty DataFrame if no data found.
        """
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT date, open, high, low, close, volume, adj_close, source
                    FROM stock_data 
                    WHERE ticker_symbol = ? 
                    AND date >= ? 
                    AND date <= ?
                    ORDER BY date ASC
                """
                
                cursor = conn.execute(query, (ticker, start_date, end_date))
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
        Uses market calendar to only consider actual trading days.
        Optimized with caching and early exit logic.
        """
        try:
            # Create cache key for this request
            cache_key = f"{ticker}:{start_date}:{end_date}"
            current_time = time.time()
            
            # Check if we have a cached result that's still valid
            if cache_key in self._gap_detection_cache:
                cached_result, cache_time = self._gap_detection_cache[cache_key]
                if current_time - cache_time < self._gap_cache_ttl:
                    self.logger.debug(f"Using cached gap detection for {ticker}")
                    return cached_result
            
            # OPTIMIZATION: Quick early exit check - see if we have recent comprehensive data
            # This avoids expensive gap detection for well-cached tickers
            with self.get_connection() as conn:
                # Quick check: do we have data coverage for most of the range?
                quick_check_query = """
                    SELECT 
                        MIN(date) as first_date,
                        MAX(date) as last_date,
                        COUNT(*) as record_count
                    FROM stock_data 
                    WHERE ticker_symbol = ? 
                    AND date >= ? 
                    AND date <= ?
                """
                
                cursor = conn.execute(quick_check_query, (ticker, start_date, end_date))
                result = cursor.fetchone()
                
                if result and result['record_count']:
                    first_cached = datetime.strptime(result['first_date'], '%Y-%m-%d').date()
                    last_cached = datetime.strptime(result['last_date'], '%Y-%m-%d').date()
                    record_count = result['record_count']
                    
                    # Estimate expected trading days in range
                    expected_days = self.market_calendar.estimate_trading_days_count(start_date, end_date)
                    coverage_ratio = record_count / expected_days if expected_days > 0 else 0
                    
                    # Early exit if we have excellent coverage (>95%) and data spans the range
                    if (coverage_ratio > 0.95 and 
                        first_cached <= start_date + timedelta(days=5) and  # Within 5 days of start
                        last_cached >= end_date - timedelta(days=5)):      # Within 5 days of end
                        
                        self.logger.info(f"Early exit: Excellent cache coverage for {ticker} ({coverage_ratio:.1%})")
                        empty_result = []
                        self._gap_detection_cache[cache_key] = (empty_result, current_time)
                        return empty_result
                
                # If we reach here, we need full gap detection
                # Get all cached dates for this ticker in the range
                detailed_query = """
                    SELECT date 
                    FROM stock_data 
                    WHERE ticker_symbol = ? 
                    AND date >= ? 
                    AND date <= ?
                    ORDER BY date ASC
                """
                
                cursor = conn.execute(detailed_query, (ticker, start_date, end_date))
                cached_dates = {datetime.strptime(row['date'], '%Y-%m-%d').date() for row in cursor.fetchall()}
                
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
                
                # Calculate actual trading days missing (not just business days)
                total_missing_days = 0
                for r in missing_ranges:
                    total_missing_days += self.market_calendar.estimate_trading_days_count(r.start_date, r.end_date)
                
                # Cache the result
                self._gap_detection_cache[cache_key] = (missing_ranges, current_time)
                
                if missing_ranges:
                    self.logger.info(f"Found {len(missing_ranges)} missing ranges for {ticker} ({total_missing_days} trading days)")
                else:
                    self.logger.debug(f"No missing ranges for {ticker} in requested period")
                
                return missing_ranges
                
        except Exception as e:
            self.logger.error(f"Error detecting missing ranges for {ticker}: {e}")
            # Fallback: assume everything is missing
            return [DateRange(start_date, end_date)]
    
    def get_missing_ranges_chunked(self, ticker: str, start_date: date, end_date: date, 
                                 chunk_years: int = 10) -> List[DateRange]:
        """
        Get missing ranges using chunked approach for very large date ranges.
        This prevents memory issues and speeds up processing for multi-decade requests.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for analysis
            end_date: End date for analysis  
            chunk_years: Size of chunks in years (default: 10 years)
            
        Returns:
            List of missing date ranges
        """
        try:
            # If range is small enough, use regular method
            total_years = (end_date - start_date).days / 365.25
            if total_years <= chunk_years:
                return self.get_missing_ranges(ticker, start_date, end_date)
            
            self.logger.info(f"Using chunked gap detection for {ticker} ({total_years:.1f} years)")
            
            all_missing_ranges = []
            current_start = start_date
            
            while current_start < end_date:
                # Calculate chunk end date
                chunk_end = min(
                    current_start + timedelta(days=chunk_years * 365),
                    end_date
                )
                
                # Get missing ranges for this chunk
                chunk_missing = self.get_missing_ranges(ticker, current_start, chunk_end)
                all_missing_ranges.extend(chunk_missing)
                
                # Move to next chunk
                current_start = chunk_end + timedelta(days=1)
            
            # Merge adjacent ranges to optimize API calls
            merged_ranges = self._merge_adjacent_ranges(all_missing_ranges)
            
            self.logger.info(f"Chunked gap detection complete: {len(merged_ranges)} ranges after merging")
            return merged_ranges
            
        except Exception as e:
            self.logger.error(f"Error in chunked gap detection for {ticker}: {e}")
            return []
    
    def _merge_adjacent_ranges(self, ranges: List[DateRange]) -> List[DateRange]:
        """
        Merge adjacent or overlapping date ranges to minimize API calls.
        
        Args:
            ranges: List of date ranges to merge
            
        Returns:
            List of merged date ranges
        """
        if not ranges:
            return []
        
        # Sort ranges by start date
        sorted_ranges = sorted(ranges, key=lambda r: r.start_date)
        merged = [sorted_ranges[0]]
        
        for current in sorted_ranges[1:]:
            last_merged = merged[-1]
            
            # Check if ranges are adjacent or overlapping (within 5 days)
            gap_days = (current.start_date - last_merged.end_date).days
            if gap_days <= 5:  # Merge if gap is 5 days or less
                # Extend the last merged range
                merged[-1] = DateRange(
                    last_merged.start_date,
                    max(last_merged.end_date, current.end_date)
                )
            else:
                merged.append(current)
        
        return merged
    
    def clear_gap_detection_cache(self):
        """Clear the gap detection cache to free memory."""
        self._gap_detection_cache.clear()
        self.logger.info("Gap detection cache cleared")
    
    def cache_data(self, ticker: str, data: pd.DataFrame, source: str) -> bool:
        """
        Cache fetched data with efficient bulk operations.
        Returns True if successful, False otherwise.
        """
        if data.empty:
            return True
        
        try:
            with self.get_connection() as conn:
                # Ensure ticker exists in tickers table
                conn.execute(
                    "INSERT OR IGNORE INTO tickers (symbol) VALUES (?)",
                    (ticker,)
                )
                
                # Prepare data for insertion
                insert_data = []
                for idx, row in data.iterrows():
                    insert_data.append((
                        ticker,
                        idx.date().isoformat(),  # Convert to string for SQLite
                        float(row['Open']),
                        float(row['High']),
                        float(row['Low']),
                        float(row['Close']),
                        int(row['Volume']),
                        float(row['Adj Close']),
                        source
                    ))
                
                # Bulk insert with conflict resolution
                conn.executemany("""
                    INSERT OR REPLACE INTO stock_data 
                    (ticker_symbol, date, open, high, low, close, volume, adj_close, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, insert_data)
                
                # Record cache range metadata
                start_date = data.index.min().date()
                end_date = data.index.max().date()
                
                conn.execute("""
                    INSERT INTO cache_ranges 
                    (ticker_symbol, start_date, end_date, source, record_count)
                    VALUES (?, ?, ?, ?, ?)
                """, (ticker, start_date.isoformat(), end_date.isoformat(), source, len(data)))
                
                # Update ticker metadata
                conn.execute("""
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
                    cursor = conn.execute(query, (ticker,))
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
                    cursor = conn.execute(query)
                
                stats = []
                for row in cursor.fetchall():
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
                        coverage_percentage=self._calculate_coverage(row['symbol'], conn),
                        freshness_status=freshness
                    ))
                
                return stats
                
        except Exception as e:
            self.logger.error(f"Error getting cache stats: {e}")
            return []
    
    def _calculate_coverage(self, ticker: str, conn) -> float:
        """Calculate cache coverage percentage for recent trading days."""
        try:
            # Calculate coverage for last 252 trading days (1 year)
            end_date = date.today()
            start_date = end_date - timedelta(days=365)
            
            # Count cached business days
            cursor = conn.execute("""
                SELECT COUNT(*) as cached_days
                FROM stock_data 
                WHERE ticker_symbol = ? 
                AND date >= ? 
                AND date <= ?
                AND CAST(strftime('%w', date) AS INTEGER) NOT IN (0, 6)
            """, (ticker, start_date.isoformat(), end_date.isoformat()))
            
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

    # ========================================================================
    # DIVIDEND GAP DETECTION AND CACHING METHODS
    # ========================================================================
    
    def get_missing_dividend_ranges(self, ticker: str, start_date: date, end_date: date) -> List[DateRange]:
        """
        Identify missing dividend date ranges that need to be fetched from APIs.
        Uses intelligent gap detection for dividend data with quarterly pattern awareness.
        
        Args:
            ticker: Stock symbol
            start_date: Start date for dividend data
            end_date: End date for dividend data
            
        Returns:
            List of DateRange objects representing missing dividend periods
        """
        try:
            with self.get_connection() as conn:
                # Get all cached dividend dates for this ticker in the range
                query = """
                    SELECT ex_date 
                    FROM dividends 
                    WHERE ticker_symbol = ? 
                    AND ex_date >= ? 
                    AND ex_date <= ?
                    ORDER BY ex_date ASC
                """
                
                cursor = conn.execute(query, (ticker, start_date.isoformat(), end_date.isoformat()))
                cached_dividend_dates = {
                    datetime.strptime(row['ex_date'], '%Y-%m-%d').date() 
                    for row in cursor.fetchall()
                }
                
                # Get cached ranges to understand what periods we've already checked
                range_query = """
                    SELECT start_date, end_date 
                    FROM dividend_cache_ranges 
                    WHERE ticker_symbol = ?
                    AND NOT (end_date < ? OR start_date > ?)
                    ORDER BY start_date ASC
                """
                
                cursor = conn.execute(range_query, (ticker, start_date.isoformat(), end_date.isoformat()))
                cached_ranges = [
                    (datetime.strptime(row['start_date'], '%Y-%m-%d').date(),
                     datetime.strptime(row['end_date'], '%Y-%m-%d').date())
                    for row in cursor.fetchall()
                ]
                
                missing_ranges = self._find_dividend_gaps(
                    start_date, end_date, cached_ranges, cached_dividend_dates
                )
                
                if missing_ranges:
                    self.logger.info(f"Found {len(missing_ranges)} missing dividend ranges for {ticker}")
                    for range_item in missing_ranges:
                        self.logger.debug(f"Missing range: {range_item.start_date} to {range_item.end_date}")
                else:
                    self.logger.debug(f"No missing dividend ranges for {ticker} in requested period")
                
                return missing_ranges
                
        except Exception as e:
            self.logger.error(f"Error detecting missing dividend ranges for {ticker}: {e}")
            # Fallback: assume everything is missing
            return [DateRange(start_date, end_date)]
    
    def _find_dividend_gaps(self, start_date: date, end_date: date, 
                           cached_ranges: List[Tuple[date, date]], 
                           cached_dividend_dates: set) -> List[DateRange]:
        """
        Find gaps in dividend cache coverage using intelligent gap detection.
        
        Args:
            start_date: Requested start date
            end_date: Requested end date
            cached_ranges: List of (start, end) tuples for cached periods
            cached_dividend_dates: Set of dates with cached dividend data
            
        Returns:
            List of DateRange objects representing gaps
        """
        if not cached_ranges:
            # No cached ranges at all - need to fetch everything
            return [DateRange(start_date, end_date)]
        
        # Sort cached ranges by start date
        cached_ranges.sort(key=lambda x: x[0])
        
        missing_ranges = []
        current_date = start_date
        
        for range_start, range_end in cached_ranges:
            # If there's a gap before this cached range
            if current_date < range_start:
                missing_ranges.append(DateRange(current_date, range_start - timedelta(days=1)))
            
            # Move current_date to end of this cached range
            current_date = max(current_date, range_end + timedelta(days=1))
        
        # Check if there's a gap after the last cached range
        if current_date <= end_date:
            missing_ranges.append(DateRange(current_date, end_date))
        
        # Consolidate nearby gaps (within 30 days) to minimize API calls
        return self._consolidate_dividend_gaps(missing_ranges)
    
    def _consolidate_dividend_gaps(self, gaps: List[DateRange]) -> List[DateRange]:
        """
        Consolidate nearby gaps to minimize API calls.
        Merges gaps that are within 30 days of each other.
        """
        if len(gaps) <= 1:
            return gaps
        
        consolidated = []
        current_gap = gaps[0]
        
        for next_gap in gaps[1:]:
            # If gaps are close (within 30 days), merge them
            days_between = (next_gap.start_date - current_gap.end_date).days
            if days_between <= 30:
                # Merge gaps
                current_gap = DateRange(current_gap.start_date, next_gap.end_date)
            else:
                # Keep current gap and start new one
                consolidated.append(current_gap)
                current_gap = next_gap
        
        # Add the last gap
        consolidated.append(current_gap)
        
        return consolidated
    
    def cache_dividend_data(self, ticker: str, dividend_data: pd.DataFrame, 
                           start_date: date, end_date: date, source: str) -> bool:
        """
        Cache dividend data with range tracking for gap detection.
        
        Args:
            ticker: Stock symbol
            dividend_data: DataFrame with dividend information
            start_date: Start date of the fetched range
            end_date: End date of the fetched range  
            source: Data source name
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                # Ensure ticker exists in tickers table
                conn.execute(
                    "INSERT OR IGNORE INTO tickers (symbol) VALUES (?)",
                    (ticker,)
                )
                
                # Cache dividend data if any exists
                if not dividend_data.empty:
                    insert_data = []
                    for _, row in dividend_data.iterrows():
                        # Handle different date formats
                        ex_date = row.get('ex_date')
                        if hasattr(ex_date, 'date'):
                            ex_date_str = ex_date.date().isoformat()
                        else:
                            ex_date_str = str(ex_date)
                            
                        payment_date = row.get('payment_date')
                        if payment_date and hasattr(payment_date, 'date'):
                            payment_date_str = payment_date.date().isoformat()
                        else:
                            payment_date_str = str(payment_date) if payment_date else None
                        
                        insert_data.append((
                            ticker,
                            ex_date_str,
                            float(row.get('dividend_amount', 0)),
                            payment_date_str,
                            None,  # record_date
                            str(row.get('dividend_type', 'regular')),
                            str(row.get('currency', 'USD')),
                            1,     # frequency (quarterly assumed)
                            source,
                            datetime.now().isoformat()
                        ))
                    
                    # Bulk insert with conflict resolution
                    conn.executemany("""
                        INSERT OR REPLACE INTO dividends 
                        (ticker_symbol, ex_date, dividend_amount, payment_date, record_date, 
                         dividend_type, currency, frequency, source, last_updated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, insert_data)
                    
                    self.logger.info(f"Cached {len(insert_data)} dividend records for {ticker}")
                
                # Record the cache range (even if no dividends found)
                conn.execute("""
                    INSERT OR REPLACE INTO dividend_cache_ranges 
                    (ticker_symbol, start_date, end_date, source, last_updated)
                    VALUES (?, ?, ?, ?, ?)
                """, (ticker, start_date.isoformat(), end_date.isoformat(), 
                      source, datetime.now().isoformat()))
                
                # Commit the transaction
                conn.commit()
                
                self.logger.debug(f"Recorded dividend cache range for {ticker}: {start_date} to {end_date}")
                return True
                
        except Exception as e:
            self.logger.error(f"Error caching dividend data for {ticker}: {e}")
            return False
    
    def get_dividend_cache_coverage(self, ticker: str) -> Dict[str, Any]:
        """
        Get comprehensive dividend cache coverage statistics for a ticker.
        
        Args:
            ticker: Stock symbol
            
        Returns:
            Dictionary with cache coverage information
        """
        try:
            with self.get_connection() as conn:
                # Get dividend data statistics
                dividend_stats_query = """
                    SELECT 
                        COUNT(*) as total_dividends,
                        MIN(ex_date) as first_dividend,
                        MAX(ex_date) as last_dividend,
                        SUM(dividend_amount) as total_amount
                    FROM dividends 
                    WHERE ticker_symbol = ?
                """
                
                cursor = conn.execute(dividend_stats_query, (ticker,))
                dividend_stats = cursor.fetchone()
                
                # Get cache range statistics
                range_stats_query = """
                    SELECT 
                        COUNT(*) as range_count,
                        MIN(start_date) as earliest_range,
                        MAX(end_date) as latest_range
                    FROM dividend_cache_ranges 
                    WHERE ticker_symbol = ?
                """
                
                cursor = conn.execute(range_stats_query, (ticker,))
                range_stats = cursor.fetchone()
                
                return {
                    'ticker': ticker,
                    'total_dividends': dividend_stats['total_dividends'] or 0,
                    'first_dividend': dividend_stats['first_dividend'],
                    'last_dividend': dividend_stats['last_dividend'],
                    'total_amount': float(dividend_stats['total_amount'] or 0),
                    'cached_ranges': range_stats['range_count'] or 0,
                    'earliest_cached': range_stats['earliest_range'],
                    'latest_cached': range_stats['latest_range'],
                    'last_updated': datetime.now().isoformat()
                }
                
        except Exception as e:
            self.logger.error(f"Error getting dividend cache coverage for {ticker}: {e}")
            return {
                'ticker': ticker,
                'error': str(e),
                'total_dividends': 0,
                'cached_ranges': 0
            }
    
    def invalidate_dividend_cache(self, ticker: str, start_date: date = None, end_date: date = None) -> bool:
        """
        Invalidate dividend cache for a ticker within optional date range.
        Useful for handling data corrections or quality issues.
        
        Args:
            ticker: Stock symbol
            start_date: Optional start date for partial invalidation
            end_date: Optional end date for partial invalidation
            
        Returns:
            True if successful, False otherwise
        """
        try:
            with self.get_connection() as conn:
                if start_date and end_date:
                    # Partial invalidation
                    conn.execute("""
                        DELETE FROM dividends 
                        WHERE ticker_symbol = ? AND ex_date >= ? AND ex_date <= ?
                    """, (ticker, start_date.isoformat(), end_date.isoformat()))
                    
                    conn.execute("""
                        DELETE FROM dividend_cache_ranges 
                        WHERE ticker_symbol = ? 
                        AND NOT (end_date < ? OR start_date > ?)
                    """, (ticker, start_date.isoformat(), end_date.isoformat()))
                    
                    self.logger.info(f"Invalidated dividend cache for {ticker} from {start_date} to {end_date}")
                else:
                    # Complete invalidation
                    conn.execute("DELETE FROM dividends WHERE ticker_symbol = ?", (ticker,))
                    conn.execute("DELETE FROM dividend_cache_ranges WHERE ticker_symbol = ?", (ticker,))
                    
                    self.logger.info(f"Completely invalidated dividend cache for {ticker}")
                
                # Commit the transaction
                conn.commit()
                
                return True
                
        except Exception as e:
            self.logger.error(f"Error invalidating dividend cache for {ticker}: {e}")
            return False
    
    # ========================================================================
    # INFLATION DATA METHODS (FOR MONTE CARLO SIMULATIONS)
    # ========================================================================
    
    def get_cached_inflation_data(self, start_date: date, end_date: date, source: str = 'FRED') -> pd.DataFrame:
        """
        Retrieve cached inflation data for the specified date range.
        
        Args:
            start_date: Start date for inflation data
            end_date: End date for inflation data
            source: Data source (default: 'FRED')
            
        Returns:
            DataFrame with inflation data
        """
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT date, cpi_rate, source, created_at
                    FROM inflation_data 
                    WHERE date >= ? 
                    AND date <= ?
                    AND source = ?
                    ORDER BY date ASC
                """
                
                cursor = conn.execute(query, (start_date.isoformat(), end_date.isoformat(), source))
                rows = cursor.fetchall()
                
                if not rows:
                    return pd.DataFrame()
                
                # Convert to DataFrame
                df = pd.DataFrame([dict(row) for row in rows])
                df['date'] = pd.to_datetime(df['date'])
                df.set_index('date', inplace=True)
                
                self.logger.info(f"Retrieved {len(df)} cached inflation records from {source}")
                return df
                
        except Exception as e:
            self.logger.error(f"Error retrieving cached inflation data: {e}")
            return pd.DataFrame()
    
    def cache_inflation_data(self, inflation_data: pd.DataFrame, source: str = 'FRED') -> bool:
        """
        Cache inflation data with efficient bulk operations.
        
        Args:
            inflation_data: DataFrame with date and cpi_rate columns
            source: Data source name
            
        Returns:
            True if successful, False otherwise
        """
        if inflation_data.empty:
            return True
        
        try:
            with self.get_connection() as conn:
                # Prepare data for insertion
                insert_data = []
                for idx, row in inflation_data.iterrows():
                    # Handle both index-based and column-based date access
                    if hasattr(idx, 'date'):
                        date_str = idx.date().isoformat()
                    else:
                        date_str = str(idx)
                        
                    cpi_rate = row.get('cpi_rate') or row.get('CPI_RATE') or row.get('rate')
                    
                    if cpi_rate is not None:
                        insert_data.append((
                            date_str,
                            float(cpi_rate),
                            source
                        ))
                
                # Bulk insert with conflict resolution
                conn.executemany("""
                    INSERT OR REPLACE INTO inflation_data 
                    (date, cpi_rate, source)
                    VALUES (?, ?, ?)
                """, insert_data)
                
                conn.commit()
                
                self.logger.info(f"Cached {len(insert_data)} inflation records from {source}")
                return True
                
        except Exception as e:
            self.logger.error(f"Error caching inflation data: {e}")
            return False
    
    def get_inflation_coverage(self, source: str = 'FRED') -> Dict[str, Any]:
        """
        Get comprehensive inflation data coverage statistics.
        
        Args:
            source: Data source to check
            
        Returns:
            Dictionary with coverage information
        """
        try:
            with self.get_connection() as conn:
                query = """
                    SELECT 
                        COUNT(*) as total_records,
                        MIN(date) as first_date,
                        MAX(date) as last_date,
                        AVG(cpi_rate) as avg_cpi_rate,
                        MIN(cpi_rate) as min_cpi_rate,
                        MAX(cpi_rate) as max_cpi_rate
                    FROM inflation_data 
                    WHERE source = ?
                """
                
                cursor = conn.execute(query, (source,))
                row = cursor.fetchone()
                
                return {
                    'source': source,
                    'total_records': row['total_records'] or 0,
                    'first_date': row['first_date'],
                    'last_date': row['last_date'],
                    'avg_cpi_rate': float(row['avg_cpi_rate'] or 0),
                    'min_cpi_rate': float(row['min_cpi_rate'] or 0),
                    'max_cpi_rate': float(row['max_cpi_rate'] or 0),
                    'last_updated': datetime.now().isoformat()
                }
                
        except Exception as e:
            self.logger.error(f"Error getting inflation coverage for {source}: {e}")
            return {
                'source': source,
                'error': str(e),
                'total_records': 0
            }
    
    def close(self):
        """Clean up database connections."""
        # SQLite connections are closed automatically in context manager
        self.logger.info("SQLite cache manager closed")