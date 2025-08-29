"""
Inflation Data Fetcher with caching support for Monte Carlo simulations.
Integrates FRED API with SQLite cache for efficient inflation data management.
"""

import os
import logging
import pandas as pd
from typing import Optional, Dict, Any, List
from datetime import datetime, date, timedelta
from dataclasses import dataclass

from sqlite_cache_manager import SQLiteStockDataCache
from fred_source import FredSource


@dataclass
class InflationDataRange:
    """Represents a date range for inflation data."""
    start_date: date
    end_date: date
    frequency: str = 'monthly'


class InflationDataFetcher:
    """
    Intelligent inflation data fetcher with caching and gap detection.
    Optimized for Monte Carlo portfolio simulations requiring historical CPI data.
    """
    
    def __init__(self, cache_manager: Optional[SQLiteStockDataCache] = None, 
                 fred_api_key: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        
        # Initialize cache manager
        if cache_manager:
            self.cache_manager = cache_manager
        else:
            self.cache_manager = SQLiteStockDataCache()
        
        # Initialize data sources
        self.fred_source = FredSource(fred_api_key)
        
        # Default CPI series for inflation calculations
        self.default_series = 'CPIAUCSL'  # Consumer Price Index for All Urban Consumers
        
        self.logger.info("Initialized InflationDataFetcher with FRED integration")
    
    def get_inflation_data(self, start_date: date, end_date: date, 
                          series_id: str = None, use_cache: bool = True) -> pd.DataFrame:
        """
        Get inflation data for the specified date range with intelligent caching.
        
        Args:
            start_date: Start date for inflation data
            end_date: End date for inflation data
            series_id: FRED series ID (default: CPIAUCSL)
            use_cache: Whether to use cached data
            
        Returns:
            DataFrame with date index and cpi_rate column
        """
        series_id = series_id or self.default_series
        
        try:
            # Check cache first if enabled
            if use_cache:
                cached_data = self.cache_manager.get_cached_inflation_data(
                    start_date, end_date, source='FRED'
                )
                
                if not cached_data.empty:
                    # Check if we have complete coverage
                    if self._has_complete_coverage(cached_data, start_date, end_date):
                        self.logger.info(f"Retrieved complete inflation data from cache: {len(cached_data)} records")
                        return cached_data
                    else:
                        self.logger.info(f"Partial cache coverage found: {len(cached_data)} records")
            
            # Fetch from FRED if not fully cached
            if not self.fred_source.available:
                if use_cache and not cached_data.empty:
                    self.logger.warning("FRED API not available, returning partial cached data")
                    return cached_data
                else:
                    raise ValueError("FRED API not available and no cached data found")
            
            # Fetch fresh data from FRED
            self.logger.info(f"Fetching inflation data from FRED: {start_date} to {end_date}")
            fred_data = self.fred_source.fetch_cpi_data(start_date, end_date, series_id)
            
            if fred_data.empty:
                if use_cache and not cached_data.empty:
                    self.logger.warning("FRED returned no data, using cached data")
                    return cached_data
                else:
                    self.logger.warning("No inflation data available from any source")
                    return pd.DataFrame()
            
            # Cache the new data
            if use_cache:
                success = self.cache_manager.cache_inflation_data(fred_data, source='FRED')
                if success:
                    self.logger.info(f"Cached {len(fred_data)} inflation records")
                else:
                    self.logger.warning("Failed to cache inflation data")
            
            return fred_data
            
        except Exception as e:
            self.logger.error(f"Error fetching inflation data: {e}")
            
            # Fallback to cached data if available
            if use_cache:
                try:
                    cached_data = self.cache_manager.get_cached_inflation_data(
                        start_date, end_date, source='FRED'
                    )
                    if not cached_data.empty:
                        self.logger.warning("Using cached data due to fetch error")
                        return cached_data
                except Exception as cache_error:
                    self.logger.error(f"Cache fallback also failed: {cache_error}")
            
            return pd.DataFrame()
    
    def _has_complete_coverage(self, data: pd.DataFrame, start_date: date, end_date: date) -> bool:
        """
        Check if cached data provides complete coverage for the requested date range.
        For monthly CPI data, we expect at least one data point per month.
        """
        if data.empty:
            return False
        
        # Get the actual date range of cached data
        data_start = data.index.min().date()
        data_end = data.index.max().date()
        
        # Check if cached data covers the requested range (with some tolerance)
        start_tolerance = timedelta(days=31)  # 1 month tolerance for start
        end_tolerance = timedelta(days=31)    # 1 month tolerance for end
        
        covers_start = data_start <= (start_date + start_tolerance)
        covers_end = data_end >= (end_date - end_tolerance)
        
        if not (covers_start and covers_end):
            return False
        
        # Check for reasonable data density (monthly data)
        months_requested = ((end_date.year - start_date.year) * 12 + 
                           (end_date.month - start_date.month))
        expected_points = max(1, months_requested)
        actual_points = len(data)
        
        # Allow for some missing months (80% coverage threshold)
        coverage_ratio = actual_points / expected_points if expected_points > 0 else 0
        
        has_sufficient_coverage = coverage_ratio >= 0.8
        
        self.logger.debug(f"Coverage check: {actual_points}/{expected_points} points "
                         f"({coverage_ratio:.1%}), sufficient: {has_sufficient_coverage}")
        
        return has_sufficient_coverage
    
    def calculate_annual_inflation_rates(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Calculate annual inflation rates from monthly CPI data.
        
        Args:
            data: DataFrame with monthly CPI data
            
        Returns:
            DataFrame with annual inflation rates
        """
        if data.empty:
            return pd.DataFrame()
        
        try:
            # Resample to annual data (using December values)
            annual_data = data.resample('Y').last()
            
            # The cpi_rate column already contains the inflation rate, not the CPI index
            # So we just need to use it directly
            annual_data['inflation_rate'] = annual_data['cpi_rate']
            
            # Drop the first year (no prior year for comparison)
            annual_data = annual_data.dropna()
            
            self.logger.info(f"Calculated {len(annual_data)} annual inflation rates")
            return annual_data[['inflation_rate']]
            
        except Exception as e:
            self.logger.error(f"Error calculating annual inflation rates: {e}")
            return pd.DataFrame()
    
    def get_monte_carlo_inflation_data(self, years_history: int = 20) -> pd.DataFrame:
        """
        Get inflation data optimized for Monte Carlo simulations.
        
        Args:
            years_history: Number of years of historical data to fetch
            
        Returns:
            DataFrame with annual inflation rates suitable for resampling
        """
        try:
            end_date = date.today()
            start_date = date(end_date.year - years_history, 1, 1)
            
            # Get monthly CPI data
            monthly_data = self.get_inflation_data(start_date, end_date)
            
            if monthly_data.empty:
                self.logger.warning("No inflation data available for Monte Carlo simulation")
                return pd.DataFrame()
            
            # Convert to annual rates for simulation
            annual_rates = self.calculate_annual_inflation_rates(monthly_data)
            
            if annual_rates.empty:
                self.logger.warning("Could not calculate annual inflation rates")
                return pd.DataFrame()
            
            self.logger.info(f"Prepared {len(annual_rates)} annual inflation rates for Monte Carlo")
            return annual_rates
            
        except Exception as e:
            self.logger.error(f"Error preparing Monte Carlo inflation data: {e}")
            return pd.DataFrame()
    
    def get_inflation_statistics(self, years: int = 20) -> Dict[str, float]:
        """
        Get summary statistics for inflation data.
        
        Args:
            years: Number of years of data to analyze
            
        Returns:
            Dictionary with inflation statistics
        """
        try:
            inflation_data = self.get_monte_carlo_inflation_data(years)
            
            if inflation_data.empty:
                return {}
            
            rates = inflation_data['inflation_rate']
            
            return {
                'mean_inflation': float(rates.mean()),
                'median_inflation': float(rates.median()),
                'std_inflation': float(rates.std()),
                'min_inflation': float(rates.min()),
                'max_inflation': float(rates.max()),
                'data_points': len(rates),
                'start_year': int(inflation_data.index.min().year),
                'end_year': int(inflation_data.index.max().year)
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating inflation statistics: {e}")
            return {}
    
    def get_cache_status(self) -> Dict[str, Any]:
        """Get inflation data cache status."""
        try:
            return self.cache_manager.get_inflation_coverage(source='FRED')
        except Exception as e:
            self.logger.error(f"Error getting cache status: {e}")
            return {}
    
    def warm_cache(self, years: int = 30) -> bool:
        """
        Pre-populate cache with historical inflation data.
        
        Args:
            years: Number of years of data to cache
            
        Returns:
            True if successful, False otherwise
        """
        try:
            end_date = date.today()
            start_date = date(end_date.year - years, 1, 1)
            
            self.logger.info(f"Warming inflation cache: {years} years ({start_date} to {end_date})")
            
            data = self.get_inflation_data(start_date, end_date, use_cache=False)
            
            if not data.empty:
                self.logger.info(f"Successfully warmed cache with {len(data)} inflation records")
                return True
            else:
                self.logger.warning("No data retrieved for cache warming")
                return False
                
        except Exception as e:
            self.logger.error(f"Error warming inflation cache: {e}")
            return False
    
    def close(self):
        """Clean up resources."""
        if hasattr(self, 'fred_source'):
            self.fred_source.close()
        self.logger.info("InflationDataFetcher closed")


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Test inflation data fetcher
    fetcher = InflationDataFetcher()
    
    # Test basic data fetch
    print("\n=== Inflation Data Test ===")
    end_date = date.today()
    start_date = date(end_date.year - 5, 1, 1)
    
    data = fetcher.get_inflation_data(start_date, end_date)
    print(f"Fetched {len(data)} inflation records")
    if not data.empty:
        print(data.head())
        print(data.tail())
    
    # Test Monte Carlo data preparation
    print("\n=== Monte Carlo Data Test ===")
    mc_data = fetcher.get_monte_carlo_inflation_data(years_history=10)
    print(f"Monte Carlo inflation data: {len(mc_data)} annual rates")
    if not mc_data.empty:
        print(mc_data.head())
    
    # Test statistics
    print("\n=== Inflation Statistics ===")
    stats = fetcher.get_inflation_statistics(years=10)
    print(f"Statistics: {stats}")
    
    # Test cache status
    print("\n=== Cache Status ===")
    cache_status = fetcher.get_cache_status()
    print(f"Cache: {cache_status}")
    
    # Clean up
    fetcher.close()