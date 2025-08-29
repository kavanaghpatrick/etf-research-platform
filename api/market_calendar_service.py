"""
Market Calendar Service for identifying trading days and managing gap detection.
Uses pandas_market_calendars to determine valid trading days for different exchanges.
"""

import pandas as pd
import pandas_market_calendars as mcal
from datetime import datetime, date, timedelta
from typing import List, Set, Tuple, Optional, Union
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)


class MarketCalendarService:
    """
    Service for managing market calendars and trading day detection.
    Provides efficient methods to identify trading days, holidays, and valid data gaps.
    """
    
    def __init__(self, exchange: str = 'NYSE'):
        """
        Initialize the market calendar service.
        
        Args:
            exchange: Exchange calendar to use (default: NYSE)
                     Available: NYSE, NASDAQ, TSX, LSE, EUREX, etc.
        """
        self.exchange = exchange
        try:
            self.calendar = mcal.get_calendar(exchange)
            logger.info(f"Initialized market calendar for {exchange}")
        except Exception as e:
            logger.error(f"Failed to initialize {exchange} calendar: {e}")
            # Fallback to NYSE if specified exchange fails
            self.calendar = mcal.get_calendar('NYSE')
            self.exchange = 'NYSE'
            logger.warning(f"Falling back to NYSE calendar")
    
    @lru_cache(maxsize=128)
    def get_valid_trading_days(self, start_date: Union[str, date, datetime], 
                              end_date: Union[str, date, datetime]) -> pd.DatetimeIndex:
        """
        Get valid trading days between two dates (cached for performance).
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            DatetimeIndex of valid trading days
        """
        # Convert to string format for caching
        if isinstance(start_date, (date, datetime)):
            start_date = start_date.strftime('%Y-%m-%d')
        if isinstance(end_date, (date, datetime)):
            end_date = end_date.strftime('%Y-%m-%d')
        
        valid_days = self.calendar.valid_days(start_date=start_date, end_date=end_date)
        return pd.DatetimeIndex(valid_days)
    
    def is_trading_day(self, check_date: Union[str, date, datetime]) -> bool:
        """
        Check if a specific date is a trading day.
        
        Args:
            check_date: Date to check
            
        Returns:
            True if trading day, False otherwise
        """
        if isinstance(check_date, str):
            check_date = pd.to_datetime(check_date).date()
        elif isinstance(check_date, datetime):
            check_date = check_date.date()
        
        # Check one day range to see if date is included
        valid_days = self.get_valid_trading_days(check_date, check_date)
        return len(valid_days) > 0
    
    def get_holidays(self, start_date: Union[str, date, datetime], 
                     end_date: Union[str, date, datetime]) -> List[date]:
        """
        Get market holidays between two dates.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            List of holiday dates
        """
        # Get all weekdays in range
        start = pd.to_datetime(start_date)
        end = pd.to_datetime(end_date)
        weekdays = pd.bdate_range(start=start, end=end)
        
        # Get valid trading days
        valid_days = self.get_valid_trading_days(start_date, end_date)
        
        # Holidays are weekdays that aren't trading days
        holidays = weekdays.difference(valid_days)
        return [h.date() for h in holidays]
    
    def filter_gaps_for_trading_days(self, gaps: List[Tuple[date, date]]) -> List[Tuple[date, date]]:
        """
        Filter gap ranges to only include trading days.
        
        Args:
            gaps: List of (start_date, end_date) tuples representing gaps
            
        Returns:
            Filtered list of gaps containing only trading days
        """
        filtered_gaps = []
        
        for gap_start, gap_end in gaps:
            # Get valid trading days in this gap range
            valid_days = self.get_valid_trading_days(gap_start, gap_end)
            
            if len(valid_days) > 0:
                # There are actual trading days missing in this gap
                # Adjust gap to only include trading days
                adjusted_start = valid_days[0].date()
                adjusted_end = valid_days[-1].date()
                filtered_gaps.append((adjusted_start, adjusted_end))
                
                logger.debug(f"Gap {gap_start} to {gap_end} contains {len(valid_days)} trading days")
            else:
                logger.debug(f"Gap {gap_start} to {gap_end} contains no trading days - skipping")
        
        return filtered_gaps
    
    def get_next_trading_day(self, from_date: Union[str, date, datetime]) -> Optional[date]:
        """
        Get the next trading day after a given date.
        
        Args:
            from_date: Date to start from
            
        Returns:
            Next trading day or None if not found within 30 days
        """
        current = pd.to_datetime(from_date).date()
        
        # Look ahead up to 30 days
        for i in range(1, 31):
            next_date = current + timedelta(days=i)
            if self.is_trading_day(next_date):
                return next_date
        
        return None
    
    def get_previous_trading_day(self, from_date: Union[str, date, datetime]) -> Optional[date]:
        """
        Get the previous trading day before a given date.
        
        Args:
            from_date: Date to start from
            
        Returns:
            Previous trading day or None if not found within 30 days
        """
        current = pd.to_datetime(from_date).date()
        
        # Look back up to 30 days
        for i in range(1, 31):
            prev_date = current - timedelta(days=i)
            if self.is_trading_day(prev_date):
                return prev_date
        
        return None
    
    def consolidate_gaps(self, gaps: List[Tuple[date, date]], max_gap_days: int = 5) -> List[Tuple[date, date]]:
        """
        Consolidate nearby gaps into larger ranges to reduce API calls.
        
        Args:
            gaps: List of gap ranges
            max_gap_days: Maximum days between gaps to consolidate
            
        Returns:
            Consolidated list of gap ranges
        """
        if not gaps:
            return []
        
        # Sort gaps by start date
        sorted_gaps = sorted(gaps, key=lambda x: x[0])
        consolidated = [sorted_gaps[0]]
        
        for current_start, current_end in sorted_gaps[1:]:
            last_start, last_end = consolidated[-1]
            
            # Check if current gap is close enough to merge
            days_between = (current_start - last_end).days
            
            if days_between <= max_gap_days:
                # Merge gaps
                consolidated[-1] = (last_start, max(last_end, current_end))
                logger.debug(f"Consolidated gaps: {last_start} to {current_end}")
            else:
                # Add as new gap
                consolidated.append((current_start, current_end))
        
        return consolidated
    
    def get_market_schedule(self, start_date: Union[str, date, datetime], 
                           end_date: Union[str, date, datetime]) -> pd.DataFrame:
        """
        Get detailed market schedule including open/close times.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            DataFrame with market open/close times
        """
        return self.calendar.schedule(start_date=start_date, end_date=end_date)
    
    def estimate_trading_days_count(self, start_date: Union[str, date, datetime], 
                                   end_date: Union[str, date, datetime]) -> int:
        """
        Estimate the number of trading days in a date range.
        Useful for progress tracking and validation.
        
        Args:
            start_date: Start date
            end_date: End date
            
        Returns:
            Estimated number of trading days
        """
        valid_days = self.get_valid_trading_days(start_date, end_date)
        return len(valid_days)


# Singleton instance for easy access
_market_calendar = None

def get_market_calendar(exchange: str = 'NYSE') -> MarketCalendarService:
    """
    Get or create a market calendar service instance.
    
    Args:
        exchange: Exchange calendar to use
        
    Returns:
        MarketCalendarService instance
    """
    global _market_calendar
    if _market_calendar is None or _market_calendar.exchange != exchange:
        _market_calendar = MarketCalendarService(exchange)
    return _market_calendar