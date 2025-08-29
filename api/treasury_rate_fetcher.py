"""
Treasury Rate Fetcher with dynamic risk-free rate calculation for Monte Carlo simulations.
Integrates FRED API with SQLite cache for efficient Treasury rate management.
"""

import os
import logging
import pandas as pd
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import time

from sqlite_cache_manager import SQLiteStockDataCache
from fred_source import FredSource


@dataclass
class TreasuryRateConfig:
    """Configuration for Treasury rate fetching."""
    duration: str = '3_month'  # '3_month', '1_year', '10_year'
    cache_hours: int = 4       # Cache duration in hours
    fallback_rate: float = 0.02  # 2% fallback rate


class TreasuryRateFetcher:
    """
    Dynamic Treasury rate fetcher with caching and fallback mechanisms.
    Provides current risk-free rates for Monte Carlo portfolio simulations.
    """
    
    # FRED Treasury series IDs
    TREASURY_SERIES = {
        '3_month': 'DGS3MO',    # 3-Month Treasury Constant Maturity Rate
        '1_year': 'DGS1',       # 1-Year Treasury Constant Maturity Rate
        '2_year': 'DGS2',       # 2-Year Treasury Constant Maturity Rate
        '5_year': 'DGS5',       # 5-Year Treasury Constant Maturity Rate
        '10_year': 'DGS10',     # 10-Year Treasury Constant Maturity Rate
        '30_year': 'DGS30'      # 30-Year Treasury Constant Maturity Rate
    }
    
    def __init__(self, cache_manager: Optional[SQLiteStockDataCache] = None, 
                 fred_api_key: Optional[str] = None,
                 config: Optional[TreasuryRateConfig] = None):
        self.logger = logging.getLogger(__name__)
        
        # Initialize cache manager
        if cache_manager:
            self.cache_manager = cache_manager
        else:
            self.cache_manager = SQLiteStockDataCache()
        
        # Initialize FRED source
        self.fred_source = FredSource(fred_api_key)
        
        # Configuration
        self.config = config or TreasuryRateConfig()
        
        # Cache for current rates
        self._rate_cache = {}
        self._cache_timestamps = {}
        
        self.logger.info(f"Initialized TreasuryRateFetcher with duration: {self.config.duration}")
    
    def get_current_risk_free_rate(self, duration: Optional[str] = None, 
                                  use_cache: bool = True) -> float:
        """
        Get the current risk-free rate (Treasury rate) with caching.
        
        Args:
            duration: Treasury duration ('3_month', '1_year', '10_year', etc.)
            use_cache: Whether to use cached rates
            
        Returns:
            Current risk-free rate as decimal (e.g., 0.045 for 4.5%)
        """
        duration = duration or self.config.duration
        
        if duration not in self.TREASURY_SERIES:
            self.logger.warning(f"Invalid duration '{duration}', using default")
            duration = self.config.duration
        
        try:
            # Check cache first
            if use_cache and self._is_cache_valid(duration):
                rate = self._rate_cache.get(duration)
                if rate is not None:
                    self.logger.debug(f"Using cached {duration} Treasury rate: {rate:.4f}")
                    return rate
            
            # Fetch fresh rate from FRED
            rate = self._fetch_current_rate(duration)
            
            if rate is not None:
                # Cache the rate
                self._rate_cache[duration] = rate
                self._cache_timestamps[duration] = datetime.now()
                
                self.logger.info(f"Fetched current {duration} Treasury rate: {rate:.4f} ({rate*100:.2f}%)")
                return rate
            else:
                # Fallback to cached rate if available
                if duration in self._rate_cache:
                    rate = self._rate_cache[duration]
                    self.logger.warning(f"Using stale cached {duration} Treasury rate: {rate:.4f}")
                    return rate
                
                # Final fallback to configured default
                rate = self.config.fallback_rate
                self.logger.warning(f"Using fallback {duration} Treasury rate: {rate:.4f}")
                return rate
                
        except Exception as e:
            self.logger.error(f"Error fetching {duration} Treasury rate: {e}")
            
            # Try cached rate
            if duration in self._rate_cache:
                rate = self._rate_cache[duration]
                self.logger.warning(f"Using cached {duration} Treasury rate due to error: {rate:.4f}")
                return rate
            
            # Final fallback
            rate = self.config.fallback_rate
            self.logger.warning(f"Using fallback {duration} Treasury rate due to error: {rate:.4f}")
            return rate
    
    def _is_cache_valid(self, duration: str) -> bool:
        """Check if cached rate is still valid."""
        if duration not in self._cache_timestamps:
            return False
        
        cache_time = self._cache_timestamps[duration]
        age_hours = (datetime.now() - cache_time).total_seconds() / 3600
        
        return age_hours < self.config.cache_hours
    
    def _fetch_current_rate(self, duration: str) -> Optional[float]:
        """
        Fetch current Treasury rate from FRED.
        
        Args:
            duration: Treasury duration
            
        Returns:
            Current rate as decimal or None if failed
        """
        if not self.fred_source.available:
            self.logger.warning("FRED API not available for Treasury rate fetch")
            return None
        
        series_id = self.TREASURY_SERIES[duration]
        
        try:
            # Get the last 30 days to ensure we get the most recent rate
            end_date = date.today()
            start_date = end_date - timedelta(days=30)
            
            params = {
                'series_id': series_id,
                'observation_start': start_date.strftime('%Y-%m-%d'),
                'observation_end': end_date.strftime('%Y-%m-%d'),
                'sort_order': 'desc',  # Most recent first
                'limit': 10  # Only need the latest values
            }
            
            self.logger.debug(f"Fetching {duration} Treasury rate from FRED: {series_id}")
            
            response = self.fred_source._make_request('series/observations', params)
            
            if not response or 'observations' not in response:
                self.logger.warning(f"No Treasury rate data returned from FRED for {series_id}")
                return None
            
            observations = response['observations']
            
            if not observations:
                self.logger.warning(f"Empty Treasury rate data from FRED for {series_id}")
                return None
            
            # Find the most recent valid observation
            for obs in observations:
                if obs['value'] != '.' and obs['value'] != '':
                    try:
                        rate = float(obs['value']) / 100.0  # Convert percentage to decimal
                        self.logger.debug(f"Found {duration} Treasury rate: {rate:.4f} on {obs['date']}")
                        return rate
                    except (ValueError, TypeError):
                        continue
            
            self.logger.warning(f"No valid Treasury rate values found for {series_id}")
            return None
            
        except Exception as e:
            self.logger.error(f"Error fetching {duration} Treasury rate from FRED: {e}")
            return None
    
    def get_historical_rates(self, duration: str, start_date: date, 
                           end_date: date, use_cache: bool = True) -> pd.DataFrame:
        """
        Get historical Treasury rates for analysis.
        
        Args:
            duration: Treasury duration
            start_date: Start date
            end_date: End date
            use_cache: Whether to use cached data
            
        Returns:
            DataFrame with historical Treasury rates
        """
        if duration not in self.TREASURY_SERIES:
            raise ValueError(f"Invalid duration: {duration}")
        
        series_id = self.TREASURY_SERIES[duration]
        
        try:
            # Check cache first if enabled
            if use_cache:
                # For simplicity, we'll use the existing inflation cache table
                # In a production system, you'd want a dedicated Treasury rate cache
                pass
            
            # Fetch from FRED
            if not self.fred_source.available:
                self.logger.warning("FRED API not available for historical Treasury rates")
                return pd.DataFrame()
            
            params = {
                'series_id': series_id,
                'observation_start': start_date.strftime('%Y-%m-%d'),
                'observation_end': end_date.strftime('%Y-%m-%d'),
                'sort_order': 'asc'
            }
            
            self.logger.info(f"Fetching historical {duration} Treasury rates from FRED: {start_date} to {end_date}")
            
            response = self.fred_source._make_request('series/observations', params)
            
            if not response or 'observations' not in response:
                self.logger.warning(f"No historical Treasury rate data returned from FRED for {series_id}")
                return pd.DataFrame()
            
            observations = response['observations']
            
            if not observations:
                self.logger.warning(f"Empty historical Treasury rate data from FRED for {series_id}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            data = []
            for obs in observations:
                # Skip observations with missing values
                if obs['value'] == '.' or obs['value'] == '':
                    continue
                    
                try:
                    data.append({
                        'date': obs['date'],
                        'treasury_rate': float(obs['value']) / 100.0  # Convert to decimal
                    })
                except (ValueError, KeyError) as e:
                    self.logger.warning(f"Skipping invalid Treasury rate observation: {obs}")
                    continue
            
            if not data:
                self.logger.warning(f"No valid Treasury rate observations from FRED for {series_id}")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            df.sort_index(inplace=True)
            
            self.logger.info(f"Successfully fetched {len(df)} historical Treasury rate records from FRED")
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching historical Treasury rates from FRED: {e}")
            return pd.DataFrame()
    
    def get_rate_statistics(self, duration: str, years: int = 5) -> Dict[str, float]:
        """
        Get summary statistics for Treasury rates.
        
        Args:
            duration: Treasury duration
            years: Number of years of data to analyze
            
        Returns:
            Dictionary with Treasury rate statistics
        """
        try:
            end_date = date.today()
            start_date = date(end_date.year - years, 1, 1)
            
            historical_data = self.get_historical_rates(duration, start_date, end_date)
            
            if historical_data.empty:
                return {}
            
            rates = historical_data['treasury_rate']
            
            return {
                'current_rate': self.get_current_risk_free_rate(duration),
                'mean_rate': float(rates.mean()),
                'median_rate': float(rates.median()),
                'std_rate': float(rates.std()),
                'min_rate': float(rates.min()),
                'max_rate': float(rates.max()),
                'data_points': len(rates),
                'start_date': historical_data.index.min().strftime('%Y-%m-%d'),
                'end_date': historical_data.index.max().strftime('%Y-%m-%d'),
                'duration': duration
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating Treasury rate statistics: {e}")
            return {}
    
    def get_all_current_rates(self) -> Dict[str, float]:
        """
        Get current rates for all available Treasury durations.
        
        Returns:
            Dictionary mapping duration to current rate
        """
        rates = {}
        
        for duration in self.TREASURY_SERIES.keys():
            try:
                rate = self.get_current_risk_free_rate(duration, use_cache=True)
                rates[duration] = rate
            except Exception as e:
                self.logger.error(f"Error fetching {duration} rate: {e}")
                rates[duration] = self.config.fallback_rate
        
        return rates
    
    def warm_cache(self) -> bool:
        """
        Pre-populate cache with current Treasury rates.
        
        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info("Warming Treasury rate cache...")
            
            success_count = 0
            for duration in self.TREASURY_SERIES.keys():
                try:
                    rate = self.get_current_risk_free_rate(duration, use_cache=False)
                    if rate is not None:
                        success_count += 1
                        self.logger.debug(f"Cached {duration} rate: {rate:.4f}")
                except Exception as e:
                    self.logger.error(f"Failed to cache {duration} rate: {e}")
            
            if success_count > 0:
                self.logger.info(f"Successfully warmed cache with {success_count} Treasury rates")
                return True
            else:
                self.logger.warning("No Treasury rates cached")
                return False
                
        except Exception as e:
            self.logger.error(f"Error warming Treasury rate cache: {e}")
            return False
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test FRED API connection for Treasury rates.
        
        Returns:
            Dictionary with connection status and test results
        """
        try:
            if not self.fred_source.available:
                return {
                    'source': 'FRED_Treasury',
                    'available': False,
                    'error': 'FRED API key not configured'
                }
            
            # Test with 3-month Treasury rate
            test_rate = self._fetch_current_rate('3_month')
            
            if test_rate is not None:
                return {
                    'source': 'FRED_Treasury',
                    'available': True,
                    'test_duration': '3_month',
                    'test_rate': test_rate,
                    'rate_percentage': f"{test_rate * 100:.2f}%",
                    'available_durations': list(self.TREASURY_SERIES.keys()),
                    'cache_hours': self.config.cache_hours
                }
            else:
                return {
                    'source': 'FRED_Treasury',
                    'available': False,
                    'error': 'Failed to retrieve test Treasury rate'
                }
                
        except Exception as e:
            return {
                'source': 'FRED_Treasury',
                'available': False,
                'error': str(e)
            }
    
    def close(self):
        """Clean up resources."""
        if hasattr(self, 'fred_source'):
            self.fred_source.close()
        self.logger.info("TreasuryRateFetcher closed")


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Test Treasury rate fetcher
    config = TreasuryRateConfig(duration='3_month', cache_hours=4)
    fetcher = TreasuryRateFetcher(config=config)
    
    # Test connection
    print("\n=== Treasury Rate Connection Test ===")
    status = fetcher.test_connection()
    print(f"Status: {status}")
    
    if status.get('available'):
        # Test current rate fetch
        print("\n=== Current Risk-Free Rate ===")
        current_rate = fetcher.get_current_risk_free_rate()
        print(f"Current 3-month Treasury rate: {current_rate:.4f} ({current_rate*100:.2f}%)")
        
        # Test all durations
        print("\n=== All Current Rates ===")
        all_rates = fetcher.get_all_current_rates()
        for duration, rate in all_rates.items():
            print(f"{duration.replace('_', '-')}: {rate:.4f} ({rate*100:.2f}%)")
        
        # Test historical data
        print("\n=== Historical Data Test ===")
        end_date = date.today()
        start_date = end_date - timedelta(days=365)  # 1 year
        
        historical = fetcher.get_historical_rates('10_year', start_date, end_date)
        if not historical.empty:
            print(f"Fetched {len(historical)} historical 10-year Treasury records")
            print(f"Recent rates:\n{historical.tail()}")
        
        # Test statistics
        print("\n=== Rate Statistics ===")
        stats = fetcher.get_rate_statistics('10_year', years=5)
        print(f"10-year Treasury statistics: {stats}")
        
        # Test cache warming
        print("\n=== Cache Warming ===")
        cache_success = fetcher.warm_cache()
        print(f"Cache warming successful: {cache_success}")
    
    # Clean up
    fetcher.close()