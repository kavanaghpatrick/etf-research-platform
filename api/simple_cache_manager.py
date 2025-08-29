"""
Simplified SQLite cache manager for ETF Research Platform.
Reduced from 1,177 lines to ~300 lines while maintaining core functionality.
"""

import sqlite3
import pandas as pd
from datetime import datetime, date, timedelta
from typing import List, Tuple, Optional, Dict, Any
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class DateRange:
    """Represents a date range with start and end dates."""
    start: date
    end: date

@dataclass
class CacheStats:
    """Basic cache statistics for a ticker."""
    ticker: str
    total_records: int
    first_date: Optional[date]
    last_date: Optional[date]
    coverage_percentage: float

class SimpleCacheManager:
    """
    Simplified cache manager with only essential functionality.
    Core methods: get_data, cache_data, get_missing_ranges, get_stats
    Single table: stock_data
    """
    
    def __init__(self, db_path: str = 'data/etf_platform.db'):
        """Initialize the cache with a SQLite database."""
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self._init_database()
        logger.info(f"Initialized SimpleCacheManager with database: {db_path}")
    
    def _init_database(self):
        """Create the single stock_data table if it doesn't exist."""
        cursor = self.conn.cursor()
        
        # Single, simple table for stock data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS stock_data (
                ticker TEXT NOT NULL,
                date DATE NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                adj_close REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ticker, date)
            )
        ''')
        
        # Index for efficient date range queries
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_ticker_date 
            ON stock_data(ticker, date)
        ''')
        
        self.conn.commit()
    
    def get_data(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
        """
        Get cached data for a ticker within a date range.
        Returns DataFrame with standard OHLCV columns.
        """
        query = '''
            SELECT date, open, high, low, close, volume, adj_close
            FROM stock_data
            WHERE ticker = ? AND date >= ? AND date <= ?
            ORDER BY date
        '''
        
        df = pd.read_sql_query(
            query,
            self.conn,
            params=(ticker.upper(), start_date.isoformat(), end_date.isoformat()),
            parse_dates=['date']
        )
        
        if not df.empty:
            df.set_index('date', inplace=True)
            # Rename columns to match expected format
            df.columns = ['Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close']
        
        return df
    
    def cache_data(self, ticker: str, data: pd.DataFrame, source: str = None) -> bool:
        """
        Cache stock data for a ticker.
        Data should be a DataFrame with OHLCV columns and date index.
        """
        if data.empty:
            return False
        
        ticker = ticker.upper()
        cursor = self.conn.cursor()
        
        # Prepare data for insertion
        records = []
        for date_idx, row in data.iterrows():
            records.append((
                ticker,
                date_idx.date() if hasattr(date_idx, 'date') else date_idx,
                float(row.get('Open', row.get('open', 0))),
                float(row.get('High', row.get('high', 0))),
                float(row.get('Low', row.get('low', 0))),
                float(row.get('Close', row.get('close', 0))),
                int(row.get('Volume', row.get('volume', 0))),
                float(row.get('Adj Close', row.get('adj_close', row.get('Close', row.get('close', 0)))))
            ))
        
        # Use INSERT OR REPLACE for simplicity
        cursor.executemany('''
            INSERT OR REPLACE INTO stock_data 
            (ticker, date, open, high, low, close, volume, adj_close)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', records)
        
        self.conn.commit()
        logger.info(f"Cached {len(records)} records for {ticker}")
        return True
    
    def get_missing_ranges(self, ticker: str, start_date: date, end_date: date) -> List[DateRange]:
        """
        Find date ranges that are missing from the cache.
        Returns list of DateRange objects for gaps in coverage.
        """
        ticker = ticker.upper()
        
        # Get all cached dates for this ticker in the range
        query = '''
            SELECT DISTINCT date 
            FROM stock_data 
            WHERE ticker = ? AND date >= ? AND date <= ?
            ORDER BY date
        '''
        
        cursor = self.conn.cursor()
        cursor.execute(query, (ticker, start_date.isoformat(), end_date.isoformat()))
        cached_dates = {row[0] for row in cursor.fetchall()}
        
        if not cached_dates:
            # No data cached, entire range is missing
            return [DateRange(start_date, end_date)]
        
        # Find gaps in the cached data
        missing_ranges = []
        current_date = start_date
        
        while current_date <= end_date:
            if current_date.isoformat() not in cached_dates:
                # Start of a gap
                gap_start = current_date
                
                # Find end of gap
                while current_date <= end_date and current_date.isoformat() not in cached_dates:
                    current_date += timedelta(days=1)
                
                gap_end = current_date - timedelta(days=1)
                missing_ranges.append(DateRange(gap_start, gap_end))
            else:
                current_date += timedelta(days=1)
        
        return missing_ranges
    
    def get_stats(self, ticker: Optional[str] = None) -> List[CacheStats]:
        """
        Get cache statistics for one or all tickers.
        Returns list of CacheStats objects.
        """
        if ticker:
            ticker_filter = "WHERE ticker = ?"
            params = (ticker.upper(),)
        else:
            ticker_filter = ""
            params = ()
        
        query = f'''
            SELECT 
                ticker,
                COUNT(*) as total_records,
                MIN(date) as first_date,
                MAX(date) as last_date
            FROM stock_data
            {ticker_filter}
            GROUP BY ticker
        '''
        
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        
        stats = []
        for row in cursor.fetchall():
            ticker_name = row[0]
            total_records = row[1]
            first_date = datetime.fromisoformat(row[2]).date() if row[2] else None
            last_date = datetime.fromisoformat(row[3]).date() if row[3] else None
            
            # Calculate coverage percentage (approximate)
            if first_date and last_date:
                total_days = (last_date - first_date).days + 1
                # Assuming ~252 trading days per year
                expected_records = total_days * (252 / 365)
                coverage = min(100, (total_records / expected_records) * 100)
            else:
                coverage = 0
            
            stats.append(CacheStats(
                ticker=ticker_name,
                total_records=total_records,
                first_date=first_date,
                last_date=last_date,
                coverage_percentage=coverage
            ))
        
        return stats
    
    def optimize_api_usage(self, ticker: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """
        Simple optimization analysis for API usage.
        Returns basic recommendations for minimizing API calls.
        """
        ticker = ticker.upper()
        missing_ranges = self.get_missing_ranges(ticker, start_date, end_date)
        
        if not missing_ranges:
            return {
                'status': 'optimal',
                'message': 'All data available in cache',
                'api_calls_needed': 0,
                'missing_ranges': []
            }
        
        # Calculate total missing days
        total_missing_days = sum(
            (r.end - r.start).days + 1 for r in missing_ranges
        )
        
        return {
            'status': 'fetch_required',
            'message': f'Need to fetch {total_missing_days} days of data',
            'api_calls_needed': len(missing_ranges),
            'missing_ranges': [
                {'start': r.start.isoformat(), 'end': r.end.isoformat()}
                for r in missing_ranges
            ]
        }
    
    def clear_ticker(self, ticker: str) -> bool:
        """Clear all cached data for a specific ticker."""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM stock_data WHERE ticker = ?', (ticker.upper(),))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def get_tickers(self) -> List[str]:
        """Get list of all tickers in the cache."""
        cursor = self.conn.cursor()
        cursor.execute('SELECT DISTINCT ticker FROM stock_data ORDER BY ticker')
        return [row[0] for row in cursor.fetchall()]
    
    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            logger.info("Closed SimpleCacheManager database connection")

# Compatibility methods for existing code
def get_cached_data(self, ticker: str, start_date: date, end_date: date) -> pd.DataFrame:
    """Backward compatibility wrapper for get_data."""
    return self.get_data(ticker, start_date, end_date)

def get_missing_ranges_chunked(self, ticker: str, start_date: date, end_date: date, 
                               chunk_years: int = 5) -> List[DateRange]:
    """
    Backward compatibility wrapper that just calls get_missing_ranges.
    The chunking was over-engineering for ranges that are typically <5 years.
    """
    return self.get_missing_ranges(ticker, start_date, end_date)

def get_cache_stats(self, ticker: Optional[str] = None) -> List[CacheStats]:
    """Backward compatibility wrapper for get_stats."""
    return self.get_stats(ticker)

# Add compatibility methods to the class
SimpleCacheManager.get_cached_data = get_cached_data
SimpleCacheManager.get_missing_ranges_chunked = get_missing_ranges_chunked
SimpleCacheManager.get_cache_stats = get_cache_stats

# Compatibility aliases for existing code
SQLiteStockDataCache = SimpleCacheManager  # Alias for backward compatibility