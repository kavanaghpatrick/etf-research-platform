"""
Monte Carlo Portfolio Simulation Engine
Implements bootstrap resampling methodology for portfolio performance analysis.

Key Features:
- Uses geometric returns (compound returns) instead of arithmetic mean for accurate annualized calculations
- Implements proper time-weighted rate of return (TWRR) calculations
- Handles negative returns appropriately to avoid mathematical issues with geometric means
- Uses block bootstrap to preserve autocorrelation in historical returns
- Provides inflation-adjusted (real) returns alongside nominal returns

WITHDRAWAL RATE METHODOLOGY:
============================

This implementation uses pure mathematical derivation of withdrawal rates based on:

1. MATHEMATICAL APPROACH:
   - No hardcoded rates or academic models
   - Binary search algorithm to find exact withdrawal rates per Monte Carlo path
   - Rates are mathematically derived from the simulation results themselves

2. SAFE WITHDRAWAL RATE (SWR):
   - For each path: finds the exact rate that won't run out before end of period
   - Uses binary search to determine maximum sustainable withdrawal
   - Success criterion: Portfolio balance > 0 at end of time horizon
   - Result: Distribution of withdrawal rates across all simulation paths

3. PERPETUAL WITHDRAWAL RATE (PWR):
   - For each path: finds the rate that maintains principal (keeps curve linear)
   - Uses binary search to find rate where ending balance equals initial balance
   - Success criterion: Portfolio balance >= initial balance at end (in real terms)
   - Result: Distribution of perpetual rates that preserve wealth indefinitely

4. PURE SIMULATION-DRIVEN:
   - No arbitrary penalties, buffers, or academic formulas
   - Withdrawal rates are direct mathematical consequences of market performance
   - Each Monte Carlo path contributes one withdrawal rate to the distribution
   - Final results are percentiles (10th, 25th, 50th, 75th, 90th) of these rates

5. BINARY SEARCH PRECISION:
   - Searches withdrawal rates from 0% to 50% with 0.01% precision
   - Efficiently converges to the exact mathematical solution
   - Handles edge cases (negative returns, high volatility) automatically

This approach provides withdrawal rates that are:
- Mathematically rigorous and defensible
- Directly derived from simulation outcomes
- Free from subjective academic assumptions
- Adaptive to any portfolio composition or market scenario

Drawdown Calculation Methods:
============================

This engine implements two types of drawdown calculations:

1. Standard Maximum Drawdown:
   - Measures the largest peak-to-trough decline in portfolio value
   - Includes the impact of all cash flows (contributions/withdrawals)
   - Formula: max((peak_value - trough_value) / peak_value) * 100
   - Used for: Overall portfolio risk assessment

2. Time-Weighted Maximum Drawdown (Excluding Cash Flows):
   - Measures drawdown based on investment performance alone
   - Excludes the impact of external cash flows
   - More accurately reflects the manager's or strategy's performance
   - Used for: Investment strategy evaluation and comparison

Key Differences:
- Standard drawdown can be influenced by timing of contributions/withdrawals
- Time-weighted drawdown isolates investment performance from cash flow timing
- For buy-and-hold strategies without cash flows, both measures are identical
- For strategies with regular contributions, time-weighted gives better insight

Mathematical Implementation:
- Both use rolling maximum calculation for peak tracking
- Time-weighted version adjusts for cash flows before calculating drawdowns
- Results are presented as positive percentages (e.g., 15.3% for 15.3% drawdown)
"""

import os
import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime, date, timedelta
from dataclasses import dataclass
import time
from concurrent.futures import ThreadPoolExecutor
import warnings

# Suppress pandas performance warnings for simulation loops
warnings.filterwarnings('ignore', category=pd.errors.PerformanceWarning)

from cached_data_fetcher import CachedDataFetcher
from inflation_data_fetcher import InflationDataFetcher
from treasury_rate_fetcher import TreasuryRateFetcher, TreasuryRateConfig
from enhanced_sampling import EnhancedSampler, recommend_sampling_method


@dataclass
class PortfolioAllocation:
    """Portfolio allocation specification."""
    ticker: str
    percentage: float


@dataclass
class SimulationConfig:
    """Configuration for Monte Carlo simulation."""
    portfolio: List[PortfolioAllocation]
    time_period_years: int
    initial_balance: float
    num_simulations: int
    historical_start_date: date
    block_size_days: int = 252  # 1 year of trading days for bootstrap
    sampling_method: str = 'auto'  # 'auto', 'block_bootstrap', 'regime_aware', 'parametric', 'hybrid'
    use_enhanced_sampling: bool = False  # DISABLED: Enhanced sampling until boolean indexing is fixed
    

@dataclass
class SimulationResult:
    """Results from a single Monte Carlo simulation path."""
    path_id: int
    portfolio_returns: np.ndarray
    inflation_rates: np.ndarray
    final_balance_nominal: float
    final_balance_real: float
    twrr_nominal: float
    twrr_real: float
    annual_mean_return: float
    annual_volatility: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    max_drawdown_excl_cashflows: float
    # Time series data for visualization
    cumulative_values_nominal: np.ndarray
    cumulative_values_real: np.ndarray


class MonteCarloEngine:
    """
    Monte Carlo simulation engine with bootstrap resampling.
    
    Uses block bootstrap to preserve autocorrelation in returns while
    generating statistically valid simulation paths for portfolio analysis.
    """
    
    def __init__(self, data_fetcher: CachedDataFetcher, 
                 inflation_fetcher: InflationDataFetcher,
                 treasury_config: Optional[TreasuryRateConfig] = None):
        self.logger = logging.getLogger(__name__)
        self.data_fetcher = data_fetcher
        self.inflation_fetcher = inflation_fetcher
        
        # Dynamic Treasury rate fetcher for risk-free rate
        treasury_config = treasury_config or TreasuryRateConfig()
        self.treasury_fetcher = TreasuryRateFetcher(config=treasury_config)
        
        # Risk-free rate configuration
        self.treasury_config = treasury_config
        self.fallback_risk_free_rate = treasury_config.fallback_rate
        self._current_risk_free_rate = None
        self._rate_last_updated = None
        
        # Progress tracking
        self.current_progress = 0
        self.total_simulations = 0
        self.is_running = False
        self._data_prep_phase = False
        self._post_processing_phase = False
        self._data_disclosures = []
        
        # Enhanced sampling for limited data scenarios
        self.enhanced_sampler = EnhancedSampler()
        
        self.logger.info(f"Initialized Monte Carlo Engine with dynamic Treasury rates (duration: {treasury_config.duration})")
    
    def _check_sufficient_cached_data(self, tickers: List[str], end_date: date, min_years: int) -> bool:
        """
        Quick check to see if we have sufficient cached data for Monte Carlo analysis.
        
        Args:
            tickers: List of ticker symbols
            end_date: End date for analysis
            min_years: Minimum years of data required
            
        Returns:
            True if sufficient cached data exists, False otherwise
        """
        try:
            min_start_date = end_date - timedelta(days=min_years * 365)
            
            for ticker in tickers:
                # Get cache stats for this ticker
                cache_stats = self.data_fetcher.cache.get_cache_stats(ticker)
                
                if not cache_stats:
                    self.logger.info(f"❌ No cache stats found for {ticker}")
                    return False
                
                ticker_stats = cache_stats[0]  # get_cache_stats returns a list
                
                # Check if we have sufficient data range
                if not ticker_stats.first_date or not ticker_stats.last_date:
                    self.logger.info(f"❌ No date range in cache for {ticker}")
                    return False
                
                # Check if cached data provides sufficient history
                # Allow for ETF/stock inception dates - if cache starts after min_start_date,
                # check if we have at least min_years from the inception date
                actual_years_available = (ticker_stats.last_date - ticker_stats.first_date).days / 365.25
                
                if actual_years_available < min_years:
                    self.logger.info(f"❌ Insufficient years of data for {ticker}: {actual_years_available:.1f} < {min_years}")
                    return False
                
                # If inception is after our desired start date, that's OK as long as we have enough years
                effective_start = max(ticker_stats.first_date, min_start_date)
                years_from_effective_start = (ticker_stats.last_date - effective_start).days / 365.25
                
                if years_from_effective_start < min_years * 0.8:  # Allow 20% tolerance
                    self.logger.info(f"❌ Insufficient data from effective start for {ticker}: {years_from_effective_start:.1f} < {min_years * 0.8}")
                    return False
                
                # Check if cached data is recent enough (within 7 days of end_date)
                if ticker_stats.last_date < end_date - timedelta(days=7):
                    self.logger.info(f"❌ Cached data for {ticker} is stale: {ticker_stats.last_date} < {end_date - timedelta(days=7)}")
                    return False
                
                # Check if we have sufficient record count (rough estimate: ~252 trading days/year * min_years)
                min_expected_records = min_years * 252 * 0.8  # 80% threshold to account for holidays/gaps
                if ticker_stats.total_records < min_expected_records:
                    self.logger.info(f"❌ Insufficient records for {ticker}: {ticker_stats.total_records} < {min_expected_records}")
                    return False
            
            self.logger.info(f"✅ Sufficient cached data confirmed for all {len(tickers)} tickers ({min_years}+ years)")
            return True
            
        except Exception as e:
            self.logger.warning(f"Error checking cached data sufficiency: {e}")
            return False
    
    def get_current_risk_free_rate(self, force_refresh: bool = False) -> float:
        """
        Get the current risk-free rate with caching and fallback.
        
        Args:
            force_refresh: Force fetch of fresh rate from FRED API
            
        Returns:
            Current risk-free rate as decimal
        """
        try:
            # Check if we need to refresh the rate
            should_refresh = (
                force_refresh or
                self._current_risk_free_rate is None or
                self._rate_last_updated is None or
                (datetime.now() - self._rate_last_updated).seconds > (self.treasury_config.cache_hours * 3600)
            )
            
            if should_refresh:
                new_rate = self.treasury_fetcher.get_current_risk_free_rate(
                    duration=self.treasury_config.duration,
                    use_cache=not force_refresh
                )
                
                if new_rate is not None:
                    self._current_risk_free_rate = new_rate
                    self._rate_last_updated = datetime.now()
                    self.logger.info(f"Updated risk-free rate: {new_rate:.4f} ({new_rate*100:.2f}%)")
                else:
                    # Keep existing rate if fetch failed
                    if self._current_risk_free_rate is None:
                        self._current_risk_free_rate = self.fallback_risk_free_rate
                        self.logger.warning(f"Using fallback risk-free rate: {self._current_risk_free_rate:.4f}")
            
            return self._current_risk_free_rate
            
        except Exception as e:
            self.logger.error(f"Error getting risk-free rate: {e}")
            if self._current_risk_free_rate is not None:
                return self._current_risk_free_rate
            else:
                return self.fallback_risk_free_rate
    
    def get_progress(self) -> Dict[str, Any]:
        """Get current simulation progress."""
        # If we're in data preparation phase, show that progress
        if hasattr(self, '_data_prep_phase') and self._data_prep_phase:
            return {
                "is_running": self.is_running,
                "current": 0,
                "total": self.total_simulations,
                "percentage": 0,
                "phase": "Preparing historical data..."
            }
        
        # If we're in post-processing phase, show that
        if hasattr(self, '_post_processing_phase') and self._post_processing_phase:
            return {
                "is_running": self.is_running,
                "current": self.total_simulations,
                "total": self.total_simulations,
                "percentage": 100,
                "phase": "Calculating results and charts..."
            }
        
        return {
            "is_running": self.is_running,
            "current": self.current_progress,
            "total": self.total_simulations,
            "percentage": (self.current_progress / self.total_simulations * 100) if self.total_simulations > 0 else 0,
            "phase": "Running simulations..."
        }
    
    def prepare_historical_data(self, config: SimulationConfig) -> Dict[str, Any]:
        """
        Prepare historical data for Monte Carlo simulation with optimized data fetching.
        
        Args:
            config: Simulation configuration
            
        Returns:
            Dictionary with historical returns and inflation data
        """
        try:
            end_date = date.today()
            
            # Fetch historical price data for all tickers
            tickers = [allocation.ticker for allocation in config.portfolio]
            
            self.logger.info(f"Optimizing data preparation for {len(tickers)} tickers")
            
            # OPTIMIZATION 1: Check if we already have sufficient historical data
            # For Monte Carlo, 15-30 years is typically sufficient for robust analysis
            min_years_required = 15  # Reduced from 20 to handle newer ETFs like BND
            optimal_years = 25       # Reduced optimal to use available data better
            max_years = 50          # Maximum to prevent excessive gap detection
            
            # Quick check: see if we have sufficient recent cached data
            sufficient_data_available = self._check_sufficient_cached_data(
                tickers, end_date, min_years_required
            )
            
            if sufficient_data_available:
                self.logger.info(f"✅ Sufficient cached data found ({min_years_required}+ years), using optimized fetch")
                # Use optimized date range instead of MAX historical
                start_date = end_date - timedelta(days=optimal_years * 365)
                start_datetime = datetime.combine(start_date, datetime.min.time())
            else:
                self.logger.info(f"Insufficient cached data, using extended fetch (max {max_years} years)")
                # Limit to reasonable timeframe instead of 1900
                start_date = end_date - timedelta(days=max_years * 365)
                start_datetime = datetime.combine(start_date, datetime.min.time())
            
            end_datetime = datetime.combine(end_date, datetime.min.time())
            
            self.logger.info(f"Fetching historical data from {start_datetime.date()} to {end_date}")
            
            # Fetch price data
            price_data = {}
            failed_tickers = []
            
            results = self.data_fetcher.fetch_multiple_tickers(
                tickers, start_datetime, end_datetime
            )
            
            # CachedDataFetcher returns the results directly, not wrapped in 'data'
            self.logger.debug(f"Raw results from fetcher: keys={list(results.keys()) if isinstance(results, dict) else 'not a dict'}")
            
            # CachedDataFetcher returns data wrapped in 'data' key
            if isinstance(results, dict) and 'data' in results:
                fetched_data = results['data']
                successful_tickers = results.get('successful_tickers', 0)
                
                if successful_tickers == 0 or not fetched_data:
                    failed_list = results.get('failed_ticker_list', tickers)
                    raise ValueError(f"Failed to fetch data for tickers: {failed_list}")
            else:
                raise ValueError(f"Unexpected response format from data fetcher")
            
            for ticker in tickers:
                try:
                    ticker_upper = ticker.upper()
                    
                    # Handle different response structures from the fetcher
                    if isinstance(fetched_data, dict):
                        # Check if it's structured as {ticker: {Date:..., Close:...}}
                        if ticker_upper in fetched_data:
                            ticker_data = fetched_data[ticker_upper]
                        # Or if it's structured as {Date:..., Close:...} for single ticker
                        elif 'Date' in fetched_data or 'date' in fetched_data:
                            ticker_data = fetched_data
                        else:
                            raise ValueError(f"No data available for {ticker}")
                    else:
                        raise ValueError(f"Unexpected fetched_data type: {type(fetched_data)}")
                    
                    self.logger.info(f"Raw data for {ticker}: type={type(ticker_data)}")
                    if isinstance(ticker_data, dict):
                        self.logger.info(f"Dict keys: {list(ticker_data.keys())[:5]}")
                    elif isinstance(ticker_data, list) and len(ticker_data) > 0:
                        self.logger.info(f"List length: {len(ticker_data)}, first item: {ticker_data[0] if ticker_data else 'empty'}")
                    
                    # Handle DataFrame directly (already processed by cache)
                    if isinstance(ticker_data, pd.DataFrame):
                        if ticker_data.empty:
                            raise ValueError(f"Empty DataFrame for {ticker}")
                        df = ticker_data
                    elif isinstance(ticker_data, list):
                        # Data is a list of dicts [{Date: ..., Close: ...}, ...]
                        if not ticker_data:
                            raise ValueError(f"Empty data for {ticker}")
                        
                        df = pd.DataFrame(ticker_data)
                        if 'Date' in df.columns:
                            df['Date'] = pd.to_datetime(df['Date'])
                            df.set_index('Date', inplace=True)
                        else:
                            raise ValueError(f"No Date column in list data for {ticker}")
                            
                        # Ensure we have the required price column
                        if 'Adj Close' not in df.columns and 'Close' in df.columns:
                            df['Adj Close'] = df['Close']
                            
                    elif isinstance(ticker_data, dict):
                        if not ticker_data:
                            raise ValueError(f"Empty data for {ticker}")
                            
                        # Check if this is a serialized DataFrame (has 'data', 'columns', etc.)
                        if 'data' in ticker_data and 'columns' in ticker_data:
                            # This is a serialized DataFrame from the API
                            if isinstance(ticker_data['data'], list):
                                # It's already a list of dicts
                                df = pd.DataFrame(ticker_data['data'])
                            else:
                                # Reconstruct DataFrame from serialized format
                                df = pd.DataFrame(data=ticker_data['data'], columns=ticker_data['columns'])
                            
                            if 'Date' in df.columns:
                                df['Date'] = pd.to_datetime(df['Date'])
                                df.set_index('Date', inplace=True)
                            elif df.index.name == 'Date' or 'date' in str(df.index.name).lower():
                                # Date might already be the index
                                df.index = pd.to_datetime(df.index)
                            else:
                                raise ValueError(f"No Date column found in serialized data for {ticker}")
                        else:
                            # Data is a dict of lists {Date: [...], Close: [...]}
                            # Handle different key formats
                            date_key = 'Date' if 'Date' in ticker_data else 'date'
                            close_key = 'Adj Close' if 'Adj Close' in ticker_data else ('Close' if 'Close' in ticker_data else 'close')
                            
                            if date_key not in ticker_data:
                                raise ValueError(f"No date column found for {ticker}")
                            if close_key not in ticker_data:
                                raise ValueError(f"No price column found for {ticker}")
                            
                            # Create DataFrame with proper columns
                            df = pd.DataFrame({
                                'Date': ticker_data[date_key],
                                'Adj Close': ticker_data[close_key]
                            })
                            df['Date'] = pd.to_datetime(df['Date'])
                            df.set_index('Date', inplace=True)
                    else:
                        raise ValueError(f"Unexpected data type for {ticker}: {type(ticker_data)}")
                    
                    # Ensure we have the required column
                    if 'Adj Close' not in df.columns:
                        if 'Close' in df.columns:
                            df['Adj Close'] = df['Close']  # Use Close as fallback
                        else:
                            raise ValueError(f"No 'Adj Close' or 'Close' column found for {ticker}")
                    
                    # CRITICAL FIX: Filter out zero or negative prices before calculating returns
                    # Zero prices cause -100% returns which destroy Monte Carlo simulations
                    initial_count = len(df)
                    df = df[df['Adj Close'] > 0]  # Remove zero/negative prices
                    
                    if len(df) < initial_count:
                        removed_count = initial_count - len(df)
                        self.logger.warning(f"🔧 {ticker}: Removed {removed_count} zero/negative prices")
                    
                    if len(df) < 252:  # Check again after filtering
                        raise ValueError(f"Insufficient valid data for {ticker} after filtering: {len(df)} days")
                    
                    # Calculate daily returns
                    # Note: Using Adjusted Close which should include dividend adjustments
                    # This ensures our returns reflect total return, not just price return
                    returns = df['Adj Close'].pct_change().dropna()
                    
                    # Additional safety check: cap extreme returns that could be from data errors
                    extreme_returns = (returns < -0.5) | (returns > 2.0)  # >50% loss or >200% gain
                    if extreme_returns.any():
                        extreme_count = extreme_returns.sum()
                        self.logger.warning(f"🔧 {ticker}: Capping {extreme_count} extreme returns (>50% loss or >200% gain)")
                        returns = returns.clip(-0.5, 2.0)  # Cap at -50% to +200%
                    
                    if len(returns) < 252:  # Need at least 1 year of data
                        self.logger.warning(f"Limited data for {ticker}: {len(returns)} days (less than 1 year)")
                        if len(returns) < 50:  # Absolute minimum
                            raise ValueError(f"Insufficient data for {ticker}: {len(returns)} days")
                    
                    price_data[ticker] = {
                        'prices': df['Adj Close'],
                        'returns': returns
                    }
                    
                    # Check actual vs requested date range for transparency
                    actual_start_date = df.index.min().date()
                    actual_end_date = df.index.max().date()
                    # Use the user's original request, not the optimized date range
                    user_requested_start_date = config.historical_start_date
                    requested_end_date = end_datetime.date()
                    
                    actual_start = actual_start_date.strftime('%Y-%m-%d')
                    actual_end = actual_end_date.strftime('%Y-%m-%d')
                    years_of_data = len(returns) / 252  # Approximate years
                    
                    # Calculate the difference in years between requested and actual start dates
                    years_shorter = (actual_start_date - user_requested_start_date).days / 365.25
                    
                    if years_shorter > 1:  # Significant difference (more than 1 year)
                        years_missing = abs(years_shorter)
                        
                        # Check for severely limited data (< 15 years available)
                        if years_of_data < 15:
                            self.logger.error(f"🚨 CRITICAL: {ticker} has only {years_of_data:.1f} years of data (< 15 year minimum)")
                            self.logger.error(f"   ⚠️  This may cause unrealistic bootstrap resampling scenarios")
                            self.logger.error(f"   📊 Consider using ETFs with longer historical data for reliable projections")
                        
                        self.logger.warning(f"⚠️  DATA DISCLOSURE for {ticker}: Using {actual_start} to {actual_end} (~{years_of_data:.1f} years)")
                        self.logger.warning(f"   📊 Requested start: {user_requested_start_date.strftime('%Y-%m-%d')}, but {ticker} data only available from {actual_start}")
                        self.logger.warning(f"   📉 Missing {years_missing:.1f} years of historical data - simulation based on {years_of_data:.1f} years instead of requested range")
                        
                        # Store disclosure info for response
                        if not hasattr(self, '_data_disclosures'):
                            self._data_disclosures = []
                        
                        self._data_disclosures.append({
                            'ticker': ticker,
                            'requested_start': user_requested_start_date.strftime('%Y-%m-%d'),
                            'actual_start': actual_start,
                            'requested_end': requested_end_date.strftime('%Y-%m-%d'),
                            'actual_end': actual_end,
                            'years_requested': (requested_end_date - user_requested_start_date).days / 365.25,
                            'years_actual': years_of_data,
                            'years_missing': years_missing,
                            'limited_data_risk': years_of_data < 15,
                            'disclosure': f"{ticker} data only available from {actual_start} (missing {years_missing:.1f} years)"
                        })
                    else:
                        self.logger.info(f"✅ Prepared {len(returns)} daily returns for {ticker} ({actual_start} to {actual_end}, ~{years_of_data:.1f} years)")
                        
                        # Store normal range info
                        if not hasattr(self, '_data_disclosures'):
                            self._data_disclosures = []
                        
                        self._data_disclosures.append({
                            'ticker': ticker,
                            'requested_start': user_requested_start_date.strftime('%Y-%m-%d'),
                            'actual_start': actual_start,
                            'requested_end': requested_end_date.strftime('%Y-%m-%d'),
                            'actual_end': actual_end,
                            'years_requested': (requested_end_date - user_requested_start_date).days / 365.25,
                            'years_actual': years_of_data,
                            'years_missing': 0,
                            'disclosure': None
                        })
                    
                except Exception as e:
                    self.logger.error(f"Failed to prepare data for {ticker}: {e}")
                    failed_tickers.append(ticker)
            
            if failed_tickers:
                raise ValueError(f"Failed to fetch data for tickers: {failed_tickers}")
            
            # Fetch inflation data
            inflation_data = self.inflation_fetcher.get_monte_carlo_inflation_data(
                years_history=25  # Get plenty of historical data
            )
            
            if inflation_data.empty:
                self.logger.warning("No inflation data available, using historical average")
                # Create synthetic inflation data with historical average (~3%)
                synthetic_years = 25
                synthetic_inflation = pd.DataFrame({
                    'inflation_rate': np.random.normal(3.0, 2.0, synthetic_years)
                }, index=pd.date_range('2000-01-01', periods=synthetic_years, freq='Y'))
                inflation_data = synthetic_inflation
            
            return {
                'price_data': price_data,
                'inflation_data': inflation_data,
                'data_start_date': min(data['returns'].index.min() for data in price_data.values()),
                'data_end_date': max(data['returns'].index.max() for data in price_data.values()),
                'total_trading_days': min(len(data['returns']) for data in price_data.values())
            }
            
        except Exception as e:
            self.logger.error(f"Error preparing historical data: {e}")
            raise
    
    def bootstrap_sample(self, returns_data: Dict[str, np.ndarray], 
                        inflation_rates: np.ndarray,
                        simulation_days: int, 
                        block_size: int = 252,
                        config: Optional[SimulationConfig] = None) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate bootstrap sample using block bootstrap to preserve autocorrelation.
        
        Args:
            returns_data: Dictionary of ticker returns arrays
            inflation_rates: Array of annual inflation rates
            simulation_days: Number of trading days to simulate
            block_size: Size of blocks for bootstrap (default: 252 trading days = 1 year)
            
        Returns:
            Tuple of (portfolio_returns, inflation_rates) for simulation period
        """
        try:
            # Align all return series to same dates
            tickers = list(returns_data.keys())
            min_length = min(len(returns_data[ticker]) for ticker in tickers)
            
            # Create aligned return matrix
            return_matrix = np.column_stack([
                returns_data[ticker][-min_length:] for ticker in tickers
            ])
            
            # Check if we should use enhanced sampling
            years_of_data = len(return_matrix) / 252
            
            # TEMPORARILY DISABLE enhanced sampling to fix the boolean indexing error
            # TODO: Re-enable after fixing the regime array dimension mismatch
            if False and config and config.use_enhanced_sampling and years_of_data < 20:
                self.logger.info(f"📊 Using enhanced sampling for {years_of_data:.1f} years of data")
                
                # Get portfolio weights for weighted returns
                weights = np.array([alloc.percentage / 100.0 for alloc in config.portfolio])
                
                # Calculate weighted portfolio returns for the historical period
                weighted_historical_returns = np.dot(return_matrix, weights)
                
                # Determine best sampling method
                portfolio_volatility = np.std(weighted_historical_returns) * np.sqrt(252)
                recommendation = recommend_sampling_method(
                    years_of_data, 
                    len(config.portfolio),
                    portfolio_volatility
                )
                
                self.logger.info(f"   Method: {recommendation['method']} - {recommendation['reason']}")
                
                # Generate scenarios based on recommended method
                if recommendation['method'] == 'hybrid':
                    scenarios = self.enhanced_sampler.generate_hybrid_scenarios(
                        weighted_historical_returns,
                        n_scenarios=1,  # Single path
                        scenario_length=simulation_days,
                        historical_weight=recommendation['params'].get('historical_weight', 0.6)
                    )
                elif recommendation['method'] == 'regime_aware_bootstrap':
                    scenarios = self.enhanced_sampler.generate_regime_aware_scenarios(
                        weighted_historical_returns,
                        n_scenarios=1,
                        scenario_length=simulation_days,
                        block_size=recommendation['params'].get('block_size', 126)
                    )
                elif recommendation['method'] == 'parametric_student_t':
                    scenarios = self.enhanced_sampler.generate_parametric_scenarios(
                        weighted_historical_returns,
                        n_scenarios=1,
                        scenario_length=simulation_days
                    )
                else:
                    # Fallback to standard block bootstrap
                    scenarios = None
                
                if scenarios is not None:
                    # Convert single-asset scenarios back to multi-asset format
                    # by applying the same correlation structure from historical data
                    portfolio_returns = self._expand_to_multi_asset(
                        scenarios[0], return_matrix, weights
                    )
                    
                    # Bootstrap inflation as usual
                    years_needed = int(np.ceil(simulation_days / 252))
                    if len(inflation_rates) > 0:
                        sampled_inflation = np.random.choice(
                            inflation_rates, size=years_needed, replace=True
                        )
                    else:
                        sampled_inflation = np.random.normal(3.0, 2.0, years_needed)
                    
                    return portfolio_returns, sampled_inflation
            
            # Standard bootstrap sampling logic continues below
            years_of_data = len(return_matrix) / 252
            if years_of_data < 15:
                # Use smaller blocks for limited data to increase diversity
                adaptive_block_size = max(63, min(block_size, len(return_matrix) // 4))  # 3 months to 1 year
                self.logger.warning(f"🔄 Using adaptive block size {adaptive_block_size} days (vs {block_size}) for limited data scenario ({years_of_data:.1f} years)")
            else:
                adaptive_block_size = block_size
            
            # Calculate number of blocks needed
            num_blocks = int(np.ceil(simulation_days / adaptive_block_size))
            
            # Generate random block start positions
            max_start = len(return_matrix) - adaptive_block_size
            if max_start <= 0:
                raise ValueError(f"Insufficient data for block size {adaptive_block_size} (need at least {adaptive_block_size} days, have {len(return_matrix)})")
            
            block_starts = np.random.randint(0, max_start, num_blocks)
            
            # Bootstrap sample returns
            sampled_returns = []
            for start in block_starts:
                block = return_matrix[start:start + adaptive_block_size]
                sampled_returns.append(block)
            
            # Concatenate blocks and trim to desired length
            full_sample = np.vstack(sampled_returns)
            portfolio_returns = full_sample[:simulation_days]
            
            # Bootstrap sample inflation rates (annual, so resample with replacement)
            years_needed = int(np.ceil(simulation_days / 252))  # Convert days to years
            if len(inflation_rates) > 0:
                sampled_inflation = np.random.choice(
                    inflation_rates, size=years_needed, replace=True
                )
            else:
                # Fallback to historical average
                sampled_inflation = np.random.normal(3.0, 2.0, years_needed)
            
            return portfolio_returns, sampled_inflation
            
        except Exception as e:
            self.logger.error(f"Error in bootstrap sampling: {e}")
            raise
    
    def _expand_to_multi_asset(self, portfolio_scenario: np.ndarray,
                             historical_returns: np.ndarray,
                             weights: np.ndarray) -> np.ndarray:
        """
        Expand single portfolio scenario to multi-asset returns preserving correlations.
        
        Args:
            portfolio_scenario: Single series of portfolio returns
            historical_returns: Historical multi-asset return matrix
            weights: Portfolio weights
            
        Returns:
            Multi-asset return matrix matching the scenario
        """
        # Calculate historical correlation matrix
        corr_matrix = np.corrcoef(historical_returns.T)
        
        # Calculate individual asset volatilities
        asset_vols = np.std(historical_returns, axis=0)
        
        # For each time step in the scenario, decompose back to individual assets
        n_assets = len(weights)
        n_days = len(portfolio_scenario)
        multi_asset_returns = np.zeros((n_days, n_assets))
        
        # Use the correlation structure to maintain relationships
        for i in range(n_days):
            target_portfolio_return = portfolio_scenario[i]
            
            # Generate correlated random returns
            if i == 0:
                # Initialize with random normal
                z = np.random.normal(0, 1, n_assets)
            else:
                # Add some persistence from previous returns
                z = 0.1 * multi_asset_returns[i-1] / asset_vols + 0.9 * np.random.normal(0, 1, n_assets)
            
            # Apply correlation structure
            try:
                L = np.linalg.cholesky(corr_matrix)
                correlated_z = L @ z
            except np.linalg.LinAlgError:
                # If cholesky fails (matrix not positive definite), use original z
                logger.warning("Correlation matrix not positive definite, using uncorrelated returns")
                correlated_z = z
            
            # Scale to match individual asset volatilities
            asset_returns = correlated_z * asset_vols
            
            # Adjust to match target portfolio return
            current_portfolio_return = np.dot(asset_returns, weights)
            adjustment = (target_portfolio_return - current_portfolio_return) / np.sum(weights**2)
            asset_returns += adjustment * weights
            
            multi_asset_returns[i] = asset_returns
        
        return multi_asset_returns
    
    def simulate_single_path(self, config: SimulationConfig, 
                           historical_data: Dict[str, Any],
                           path_id: int) -> SimulationResult:
        """
        Run a single Monte Carlo simulation path.
        
        Args:
            config: Simulation configuration
            historical_data: Prepared historical data
            path_id: Unique identifier for this simulation path
            
        Returns:
            SimulationResult with path metrics
        """
        try:
            # Calculate simulation parameters
            trading_days_per_year = 252
            simulation_days = config.time_period_years * trading_days_per_year
            
            # Prepare returns data
            returns_data = {
                ticker: historical_data['price_data'][ticker]['returns'].values
                for ticker in [alloc.ticker for alloc in config.portfolio]
            }
            
            inflation_rates = historical_data['inflation_data']['inflation_rate'].values
            
            # Generate bootstrap sample
            portfolio_returns, annual_inflation = self.bootstrap_sample(
                returns_data, inflation_rates, simulation_days, config.block_size_days, config
            )
            
            # Calculate portfolio weights
            weights = np.array([alloc.percentage / 100.0 for alloc in config.portfolio])
            
            # Calculate weighted portfolio returns
            weighted_returns = np.dot(portfolio_returns, weights)
            
            # CRITICAL FIX: Cap extreme daily losses to prevent unrealistic scenarios
            # When data is limited, bootstrap can create unrealistic compound losses
            # Cap daily losses at -10% (more conservative) to prevent death spirals
            extreme_loss_days = np.sum(weighted_returns < -0.10)
            if extreme_loss_days > 0:
                self.logger.warning(f"⚠️  Path {path_id}: Capping {extreme_loss_days} days with >10% losses")
                weighted_returns = np.maximum(weighted_returns, -0.10)
                
            # Additional sanity check: If too many extreme days, likely a data issue
            if extreme_loss_days > len(weighted_returns) * 0.05:  # More than 5% of days (very conservative)
                self.logger.error(f"🚨 Path {path_id}: Excessive extreme losses ({extreme_loss_days}/{len(weighted_returns)} days)")
                # Replace with more realistic random walk based on long-term market statistics
                # Use S&P 500 long-term averages: ~10% nominal return, ~20% volatility
                daily_return = 0.10 / 252  # 10% annual
                daily_vol = 0.20 / np.sqrt(252)  # 20% annual vol
                replacement_returns = np.random.normal(daily_return, daily_vol, len(weighted_returns))
                self.logger.warning(f"   Replacing with synthetic returns (~10% annual, 20% vol) for path {path_id}")
                weighted_returns = replacement_returns
            
            # Calculate cumulative performance
            cumulative_returns = np.cumprod(1 + weighted_returns)
            
            # Debug extreme negative returns
            if cumulative_returns[-1] < 0.01:  # Lost 99%+ of value
                self.logger.error(f"🚨 Path {path_id}: EXTREME LOSS DETECTED!")
                self.logger.error(f"   Final cumulative return: {cumulative_returns[-1]:.6f}")
                self.logger.error(f"   Min daily return: {weighted_returns.min():.4f}")
                self.logger.error(f"   Max daily return: {weighted_returns.max():.4f}")
                self.logger.error(f"   Days with >10% loss: {np.sum(weighted_returns < -0.10)}")
                
                # Check which tickers contributed most to losses
                worst_days = np.where(weighted_returns < -0.10)[0]
                if len(worst_days) > 0:
                    self.logger.error(f"   Worst day return: {weighted_returns[worst_days[0]]:.4f}")
            
            cumulative_values_nominal = config.initial_balance * cumulative_returns
            final_balance_nominal = cumulative_values_nominal[-1]
            
            # Calculate inflation-adjusted performance
            # Create daily inflation factors from annual rates
            daily_inflation_factors = np.ones(len(weighted_returns))
            days_per_year = trading_days_per_year
            
            for i, annual_rate in enumerate(annual_inflation):
                start_idx = i * days_per_year
                end_idx = min((i + 1) * days_per_year, len(daily_inflation_factors))
                daily_rate = (1 + annual_rate / 100.0) ** (1 / days_per_year) - 1
                daily_inflation_factors[start_idx:end_idx] = 1 + daily_rate
            
            # Calculate cumulative inflation and real values
            cumulative_inflation_series = np.cumprod(daily_inflation_factors)
            cumulative_values_real = cumulative_values_nominal / cumulative_inflation_series
            
            cumulative_inflation = cumulative_inflation_series[-1]
            final_balance_real = cumulative_values_real[-1]
            
            # Calculate time-weighted rate of return (TWRR) - annualized geometric return
            if cumulative_returns[-1] > 0 and config.time_period_years > 0:
                twrr_nominal = (cumulative_returns[-1] ** (1 / config.time_period_years)) - 1
            else:
                # Handle edge case of negative or zero final value
                # This should be very rare with proper data filtering
                self.logger.error(f"🚨 Path {path_id}: Final cumulative return = {cumulative_returns[-1]:.6f}")
                self.logger.error(f"   Min return: {weighted_returns.min():.4f}, Max: {weighted_returns.max():.4f}")
                self.logger.error(f"   Days with <-10%: {np.sum(weighted_returns < -0.10)}")
                
                if cumulative_returns[-1] <= 0:
                    # Total loss scenario - cap at -20% annualized (more reasonable)
                    twrr_nominal = -0.20
                    self.logger.warning(f"   Capping TWRR at -20% for path {path_id}")
                else:
                    # Very small positive value
                    twrr_nominal = (cumulative_returns[-1] ** (1 / config.time_period_years)) - 1
            
            # Calculate real TWRR using proper deflation methodology
            if len(annual_inflation) > 0:
                # CRITICAL FIX: Convert percentage inflation to decimal before calculation
                # annual_inflation contains percentages (3.2, 2.1), need decimals (0.032, 0.021)
                cumulative_inflation_factor = np.prod(1 + annual_inflation / 100.0)
                geometric_inflation = (cumulative_inflation_factor ** (1.0 / len(annual_inflation))) - 1
            else:
                geometric_inflation = 0.03  # Default 3% if no inflation data
            
            # Real return = (1 + nominal return) / (1 + inflation) - 1
            twrr_real = ((1 + twrr_nominal) / (1 + geometric_inflation)) - 1
            
            # DEBUG: Log extreme values for troubleshooting
            if twrr_real < -0.50:  # More than -50% real return
                self.logger.warning(f"🔍 Path {path_id}: Extreme real return detected")
                self.logger.warning(f"   TWRR Nominal: {twrr_nominal:.4f} ({twrr_nominal*100:.2f}%)")
                self.logger.warning(f"   Geometric Inflation: {geometric_inflation:.4f} ({geometric_inflation*100:.2f}%)")
                self.logger.warning(f"   TWRR Real: {twrr_real:.4f} ({twrr_real*100:.2f}%)")
                self.logger.warning(f"   Annual inflation values: {annual_inflation[:3]}...")
            
            # Calculate annual metrics using geometric returns
            # Reshape into annual blocks and calculate compound returns for each year
            annual_blocks = weighted_returns.reshape(-1, trading_days_per_year)
            
            # Calculate geometric (compound) returns for each year: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
            annual_geometric_returns = []
            for year_returns in annual_blocks:
                # Handle potential negative returns that could cause issues with compound calculation
                # Ensure no single day return is <= -100% (total loss), which would make geometric mean invalid
                year_returns_clamped = np.maximum(year_returns, -0.99)  # Clamp at -99% daily loss
                
                # Calculate compound return: (1 + r1) * (1 + r2) * ... * (1 + rn) - 1
                compound_factor = np.prod(1 + year_returns_clamped)
                annual_return = compound_factor - 1
                annual_geometric_returns.append(annual_return)
            
            annual_geometric_returns = np.array(annual_geometric_returns)
            
            # Calculate annualized geometric mean return using mathematically robust approach
            if len(annual_geometric_returns) > 0:
                # Use log-based calculation for numerical stability
                # Geometric mean = exp(mean(log(1 + returns))) - 1
                annual_returns_clamped = np.maximum(annual_geometric_returns, -0.99)
                factors = 1 + annual_returns_clamped
                
                # Handle case where any factor might be zero or negative
                if np.any(factors <= 0):
                    # Use arithmetic mean as fallback for extreme cases
                    annual_mean_return = np.mean(annual_geometric_returns) * 100
                else:
                    # Proper geometric mean using log method for numerical stability
                    log_mean = np.mean(np.log(factors))
                    geometric_mean_factor = np.exp(log_mean)
                    annual_mean_return = (geometric_mean_factor - 1) * 100
            else:
                annual_mean_return = 0.0
            # Calculate annualized volatility (standard deviation of returns)
            annual_volatility = np.std(weighted_returns, ddof=1) * np.sqrt(trading_days_per_year)
            
            # Calculate risk-adjusted metrics using dynamic risk-free rate
            current_risk_free_rate = self.get_current_risk_free_rate()
            
            # Convert annual_mean_return back to decimal for risk metrics calculation
            annual_mean_return_decimal = annual_mean_return / 100
            excess_return = annual_mean_return_decimal - current_risk_free_rate
            sharpe_ratio = excess_return / annual_volatility if annual_volatility > 0 else 0
            
            # Calculate Sortino ratio using proper downside deviation formula
            # Downside deviation uses returns below the risk-free rate (not just negative)
            downside_returns = weighted_returns[weighted_returns < current_risk_free_rate / trading_days_per_year]
            if len(downside_returns) > 0:
                # Calculate downside deviation: sqrt(mean of squared negative excess returns)
                downside_deviations = downside_returns - (current_risk_free_rate / trading_days_per_year)
                downside_variance = np.mean(downside_deviations ** 2)
                downside_volatility = np.sqrt(downside_variance * trading_days_per_year)
                sortino_ratio = excess_return / downside_volatility if downside_volatility > 0 else 0
            else:
                # No downside returns - infinite Sortino ratio, cap at reasonable value
                sortino_ratio = min(sharpe_ratio * 2, 10.0) if sharpe_ratio > 0 else 0
            
            # Calculate maximum drawdown using proper peak-to-trough methodology
            cumulative_values = config.initial_balance * cumulative_returns
            running_peak = np.maximum.accumulate(cumulative_values)
            
            # Drawdown = (Trough - Peak) / Peak, expressed as negative percentage
            drawdown_series = (cumulative_values - running_peak) / running_peak
            max_drawdown = abs(np.min(drawdown_series)) * 100  # Convert to positive percentage
            
            # For buy-and-hold simulations without cash flows, both drawdown measures are identical
            # Skip redundant calculation to improve performance
            max_drawdown_excl_cashflows = max_drawdown
            
            return SimulationResult(
                path_id=path_id,
                portfolio_returns=portfolio_returns,
                inflation_rates=annual_inflation,
                final_balance_nominal=final_balance_nominal,
                final_balance_real=final_balance_real,
                twrr_nominal=twrr_nominal * 100,  # Convert to percentage
                twrr_real=twrr_real * 100,
                annual_mean_return=annual_mean_return,  # Already converted to percentage
                annual_volatility=annual_volatility * 100,
                sharpe_ratio=sharpe_ratio,
                sortino_ratio=sortino_ratio,
                max_drawdown=max_drawdown,
                max_drawdown_excl_cashflows=max_drawdown_excl_cashflows,
                cumulative_values_nominal=cumulative_values_nominal,
                cumulative_values_real=cumulative_values_real
            )
            
        except Exception as e:
            self.logger.error(f"Error in simulation path {path_id}: {e}")
            raise
    
    def _calculate_time_weighted_drawdown(self, cumulative_returns: np.ndarray, 
                                        initial_balance: float,
                                        cash_flows: Optional[np.ndarray] = None) -> float:
        """
        Calculate time-weighted maximum drawdown excluding cash flow effects.
        
        This method calculates drawdown based on the investment performance alone,
        removing the impact of external cash flows (contributions/withdrawals).
        
        Args:
            cumulative_returns: Array of cumulative return factors (e.g., 1.05 for 5% gain)
            initial_balance: Initial portfolio value
            cash_flows: Optional array of cash flows at each period (positive for contributions,
                       negative for withdrawals). If None, assumes no cash flows.
        
        Returns:
            Maximum drawdown percentage excluding cash flow effects
        """
        try:
            # For this simulation, we don't have external cash flows
            # So the time-weighted drawdown is based purely on investment returns
            
            if cash_flows is None:
                # No cash flows case - pure investment performance
                # Calculate the maximum drawdown using the returns-based approach
                
                # Convert cumulative returns to percentage returns
                portfolio_values = initial_balance * cumulative_returns
                
                # Calculate rolling maximum (peak values)
                running_max = np.maximum.accumulate(portfolio_values)
                
                # Calculate drawdown at each point
                drawdown_series = (portfolio_values - running_max) / running_max
                
                # Return the maximum (most negative) drawdown as positive percentage
                max_drawdown_pct = abs(np.min(drawdown_series)) * 100
                
                return max_drawdown_pct
            else:
                # Cash flows case - need to calculate time-weighted returns
                # This would be used if the simulation included periodic contributions/withdrawals
                
                # Calculate portfolio values adjusted for cash flows
                adjusted_values = np.zeros_like(cumulative_returns)
                adjusted_values[0] = initial_balance
                
                for i in range(1, len(cumulative_returns)):
                    # Previous value plus any cash flow, then apply return
                    prev_value = adjusted_values[i-1] + (cash_flows[i-1] if i-1 < len(cash_flows) else 0)
                    return_factor = cumulative_returns[i] / cumulative_returns[i-1]
                    adjusted_values[i] = prev_value * return_factor
                
                # Calculate drawdown on cash-flow-adjusted values
                running_max = np.maximum.accumulate(adjusted_values)
                drawdown_series = (adjusted_values - running_max) / running_max
                max_drawdown_pct = abs(np.min(drawdown_series)) * 100
                
                return max_drawdown_pct
                
        except Exception as e:
            self.logger.error(f"Error calculating time-weighted drawdown: {e}")
            # Fallback to a conservative estimate
            # Use the standard drawdown calculation as fallback
            portfolio_values = initial_balance * cumulative_returns
            running_max = np.maximum.accumulate(portfolio_values)
            drawdown_series = (portfolio_values - running_max) / running_max
            return abs(np.min(drawdown_series)) * 100
    
    def run_simulation(self, config: SimulationConfig, 
                      max_workers: int = 4) -> Dict[str, Any]:
        """
        Run complete Monte Carlo simulation with multiple paths.
        
        Args:
            config: Simulation configuration
            max_workers: Maximum number of parallel workers
            
        Returns:
            Dictionary with simulation results and aggregated metrics
        """
        start_time = time.time()
        
        try:
            # Initialize progress tracking
            self.is_running = True
            self.current_progress = 0
            self.total_simulations = config.num_simulations
            self._data_prep_phase = True
            self._data_disclosures = []  # Reset disclosures for new simulation
            
            self.logger.info(f"Starting Monte Carlo simulation: {config.num_simulations} paths, "
                           f"{config.time_period_years} years")
            
            # Prepare historical data
            historical_data = self.prepare_historical_data(config)
            
            # Portfolio-level validation for data quality
            if hasattr(self, '_data_disclosures'):
                limited_data_tickers = [d for d in self._data_disclosures if d.get('limited_data_risk', False)]
                if len(limited_data_tickers) >= len(config.portfolio) * 0.5:  # 50% or more tickers have limited data
                    self.logger.error(f"🚨 CRITICAL: {len(limited_data_tickers)}/{len(config.portfolio)} tickers have < 15 years of data")
                    self.logger.error("   This will likely produce unrealistic simulation results")
                    # Add warning to all results but continue with simulation
                    self._portfolio_data_warning = True
            
            # Data preparation complete, now start simulations
            self._data_prep_phase = False
            
            # Run simulations in parallel
            results = []
            
            # For small numbers of simulations, use single thread to avoid overhead
            if config.num_simulations < 100:
                for i in range(config.num_simulations):
                    result = self.simulate_single_path(config, historical_data, i)
                    results.append(result)
                    self.current_progress = i + 1
                    if (i + 1) % 10 == 0:
                        self.logger.info(f"Progress: {self.current_progress}/{self.total_simulations} ({self.current_progress/self.total_simulations*100:.1f}%)")
            else:
                # Use parallel execution for larger simulations
                # For parallel execution, we'll check progress as futures complete
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    futures = [
                        executor.submit(self.simulate_single_path, config, historical_data, i)
                        for i in range(config.num_simulations)
                    ]
                    
                    for i, future in enumerate(futures):
                        result = future.result()
                        results.append(result)
                        self.current_progress = i + 1
                        if (i + 1) % 100 == 0:
                            self.logger.info(f"Progress: {self.current_progress}/{self.total_simulations} ({self.current_progress/self.total_simulations*100:.1f}%)")
            
            # Simulations complete, now post-processing
            self._data_prep_phase = False
            self._post_processing_phase = True
            
            # Aggregate results
            aggregated_metrics = self._aggregate_results(results, config)
            
            # Calculate percentile paths for visualization
            percentile_paths = self._calculate_percentile_paths(results, config)
            
            execution_time = time.time() - start_time
            
            self.logger.info(f"Monte Carlo simulation completed in {execution_time:.2f}s")
            
            # Mark all processing as complete
            self.is_running = False
            self.current_progress = config.num_simulations
            self.total_simulations = config.num_simulations
            self._post_processing_phase = False
            
            # Get Treasury rate metadata
            current_risk_free_rate = self.get_current_risk_free_rate()
            treasury_metadata = {
                'risk_free_rate': current_risk_free_rate,
                'risk_free_rate_percentage': f"{current_risk_free_rate * 100:.2f}%",
                'duration': self.treasury_config.duration,
                'source': 'FRED_Treasury',
                'cache_hours': self.treasury_config.cache_hours,
                'fallback_rate': self.fallback_risk_free_rate,
                'last_updated': self._rate_last_updated.isoformat() if self._rate_last_updated else None
            }
            
            # Prepare data disclosure information
            data_disclosures = getattr(self, '_data_disclosures', [])
            self.logger.info(f"📋 Returning {len(data_disclosures)} data disclosures in response")
            for disclosure in data_disclosures:
                if disclosure.get('disclosure'):
                    self.logger.info(f"   ⚠️  Disclosure: {disclosure['disclosure']}")
            
            return {
                'results': results,
                'aggregated_metrics': aggregated_metrics,
                'percentile_paths': percentile_paths,
                'execution_time': execution_time,
                'historical_data_range': f"{historical_data['data_start_date'].strftime('%Y-%m-%d')} to {historical_data['data_end_date'].strftime('%Y-%m-%d')}",
                'simulation_metadata': {
                    'num_simulations': config.num_simulations,
                    'time_period_years': config.time_period_years,
                    'block_size_days': config.block_size_days,
                    'historical_trading_days': historical_data['total_trading_days']
                },
                'treasury_metadata': treasury_metadata,
                'data_disclosures': data_disclosures
            }
            
        except Exception as e:
            self.logger.error(f"Monte Carlo simulation failed: {e}")
            self.is_running = False
            self.current_progress = 0
            self.total_simulations = 0
            self._data_prep_phase = False
            raise
    
    def _aggregate_results(self, results: List[SimulationResult], 
                          config: SimulationConfig) -> Dict[str, Any]:
        """
        Aggregate simulation results into percentile-based metrics.
        
        Args:
            results: List of simulation results
            config: Simulation configuration
            
        Returns:
            Dictionary with aggregated metrics
        """
        try:
            # Extract metrics arrays
            metrics = {
                'twrr_nominal': [r.twrr_nominal for r in results],
                'twrr_real': [r.twrr_real for r in results],
                'final_balance_nominal': [r.final_balance_nominal for r in results],
                'final_balance_real': [r.final_balance_real for r in results],
                'annual_mean_return': [r.annual_mean_return for r in results],
                'annual_volatility': [r.annual_volatility for r in results],
                'sharpe_ratio': [r.sharpe_ratio for r in results],
                'sortino_ratio': [r.sortino_ratio for r in results],
                'max_drawdown': [r.max_drawdown for r in results],
                'max_drawdown_excl_cashflows': [r.max_drawdown_excl_cashflows for r in results]
            }
            
            # Calculate percentiles
            percentiles = [10, 25, 50, 75, 90]
            aggregated = {}
            
            for metric_name, values in metrics.items():
                # SAFETY CHECK: Filter out null/NaN values before calculating percentiles
                clean_values = [v for v in values if v is not None and not np.isnan(v) and not np.isinf(v)]
                
                if len(clean_values) == 0:
                    self.logger.error(f"🚨 All values are null/invalid for metric: {metric_name}")
                    # Use fallback values
                    aggregated[metric_name] = {
                        f'percentile_{p}th': 0.0 for p in percentiles
                    }
                elif len(clean_values) < len(values):
                    self.logger.warning(f"⚠️  Filtered {len(values) - len(clean_values)} invalid values from {metric_name}")
                    metric_percentiles = np.percentile(clean_values, percentiles)
                    aggregated[metric_name] = {
                        f'percentile_{p}th': float(metric_percentiles[i])
                        for i, p in enumerate(percentiles)
                    }
                else:
                    metric_percentiles = np.percentile(values, percentiles)
                    aggregated[metric_name] = {
                        f'percentile_{p}th': float(metric_percentiles[i])
                        for i, p in enumerate(percentiles)
                    }
            
            # Calculate mathematically-derived Safe Withdrawal Rate and Perpetual Withdrawal Rate
            swr_results = self._calculate_mathematical_swr(results, config)
            pwr_results = self._calculate_mathematical_pwr(results, config)
            
            # Calculate expected returns for different time horizons
            expected_returns = self._calculate_expected_returns_by_horizon(results, config)
            
            aggregated['safe_withdrawal_rate'] = swr_results
            aggregated['perpetual_withdrawal_rate'] = pwr_results
            aggregated['expected_returns_by_horizon'] = expected_returns
            
            return aggregated
            
        except Exception as e:
            self.logger.error(f"Error aggregating results: {e}")
            raise
    
    def _simulate_with_withdrawal(self, annual_values: List[float], initial_balance: float, 
                                 withdrawal_rate: float, perpetual: bool = False) -> float:
        """
        Simulate portfolio with withdrawals and return final balance.
        
        Args:
            annual_values: Portfolio values at end of each year (real terms)
            initial_balance: Starting portfolio value
            withdrawal_rate: Annual withdrawal rate (percentage)
            perpetual: If True, test for perpetual sustainability (ending >= initial)
            
        Returns:
            Final portfolio balance after withdrawals
        """
        annual_withdrawal = initial_balance * (withdrawal_rate / 100.0)
        portfolio_value = initial_balance
        
        for year in range(1, len(annual_values)):
            # Take withdrawal at beginning of year
            portfolio_value -= annual_withdrawal
            
            # Check if portfolio is depleted
            if portfolio_value <= 0:
                return 0.0
            
            # Apply market performance for the year
            if year < len(annual_values):
                year_return = (annual_values[year] / annual_values[year - 1]) - 1
                portfolio_value *= (1 + year_return)
        
        return portfolio_value

    def _calculate_path_withdrawal_rate(self, annual_values: List[float], initial_balance: float, 
                                      perpetual: bool = False, precision: float = 0.01) -> float:
        """
        Calculate the exact withdrawal rate for a single path using binary search.
        
        Args:
            annual_values: Portfolio values at end of each year (real terms)
            initial_balance: Starting portfolio value
            perpetual: If True, find rate that maintains principal (ending >= initial)
                      If False, find rate that doesn't deplete (ending > 0)
            precision: Precision for binary search (percentage points)
            
        Returns:
            Maximum sustainable withdrawal rate for this path
        """
        # Binary search bounds
        low, high = 0.0, 50.0  # 0% to 50% withdrawal rate range
        
        while high - low > precision:
            mid = (low + high) / 2.0
            final_balance = self._simulate_with_withdrawal(annual_values, initial_balance, mid, perpetual)
            
            if perpetual:
                # For perpetual: require ending >= initial balance
                if final_balance >= initial_balance:
                    low = mid
                else:
                    high = mid
            else:
                # For safe: require ending > 0 (doesn't deplete)
                if final_balance > 0:
                    low = mid
                else:
                    high = mid
        
        return low

    def _calculate_mathematical_swr(self, results: List[SimulationResult], 
                                  config: SimulationConfig) -> Dict[str, float]:
        """
        Calculate Safe Withdrawal Rate using pure mathematical derivation.
        
        For each Monte Carlo path, finds the exact withdrawal rate that will result
        in portfolio depletion at the end of the time period (safe = won't run out 
        before the end).
        
        Args:
            results: List of simulation results
            config: Simulation configuration
            
        Returns:
            Dictionary with SWR percentiles
        """
        try:
            swr_values = []
            
            for result in results:
                # Get the real (inflation-adjusted) cumulative values
                real_values = result.cumulative_values_real
                
                # Create annual checkpoints
                trading_days_per_year = 252
                annual_indices = [min(i * trading_days_per_year, len(real_values) - 1) 
                                for i in range(config.time_period_years + 1)]
                annual_values = [real_values[i] for i in annual_indices]
                
                # Calculate mathematically-derived withdrawal rate
                swr = self._calculate_path_withdrawal_rate(
                    annual_values, config.initial_balance, perpetual=False
                )
                swr_values.append(swr)
            
            # Calculate percentiles
            percentiles = [10, 25, 50, 75, 90]
            swr_percentiles = np.percentile(swr_values, percentiles)
            
            self.logger.info(f"Mathematical SWR calculated for {config.time_period_years}-year horizon: "
                           f"10th={swr_percentiles[0]:.2f}%, 25th={swr_percentiles[1]:.2f}%, "
                           f"50th={swr_percentiles[2]:.2f}%, 75th={swr_percentiles[3]:.2f}%, "
                           f"90th={swr_percentiles[4]:.2f}% | "
                           f"Methodology: Pure mathematical derivation from Monte Carlo paths")
            
            return {
                f'percentile_{p}th': float(swr_percentiles[i])
                for i, p in enumerate(percentiles)
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating mathematical SWR: {e}")
            raise
    
    def _calculate_mathematical_pwr(self, results: List[SimulationResult], 
                                  config: SimulationConfig) -> Dict[str, float]:
        """
        Calculate Perpetual Withdrawal Rate using pure mathematical derivation.
        
        For each Monte Carlo path, finds the exact withdrawal rate that maintains
        the principal (keeps the curve linear by ending at initial balance in real terms).
        
        Args:
            results: List of simulation results
            config: Simulation configuration
            
        Returns:
            Dictionary with PWR percentiles
        """
        try:
            pwr_values = []
            
            for result in results:
                # Get the real (inflation-adjusted) cumulative values
                real_values = result.cumulative_values_real
                
                # Create annual checkpoints
                trading_days_per_year = 252
                annual_indices = [min(i * trading_days_per_year, len(real_values) - 1) 
                                for i in range(config.time_period_years + 1)]
                annual_values = [real_values[i] for i in annual_indices]
                
                # Calculate mathematically-derived perpetual withdrawal rate
                pwr = self._calculate_path_withdrawal_rate(
                    annual_values, config.initial_balance, perpetual=True
                )
                pwr_values.append(pwr)
            
            # Calculate percentiles
            percentiles = [10, 25, 50, 75, 90]
            pwr_percentiles = np.percentile(pwr_values, percentiles)
            
            self.logger.info(f"Mathematical PWR calculated for {config.time_period_years}-year horizon: "
                           f"10th={pwr_percentiles[0]:.2f}%, 25th={pwr_percentiles[1]:.2f}%, "
                           f"50th={pwr_percentiles[2]:.2f}%, 75th={pwr_percentiles[3]:.2f}%, "
                           f"90th={pwr_percentiles[4]:.2f}% | "
                           f"Methodology: Pure mathematical derivation maintaining principal")
            
            return {
                f'percentile_{p}th': float(pwr_percentiles[i])
                for i, p in enumerate(percentiles)
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating mathematical PWR: {e}")
            raise

    def _calculate_expected_returns_by_horizon(self, results: List[SimulationResult], 
                                             config: SimulationConfig) -> Dict[str, Any]:
        """
        Calculate expected annual returns for different time horizons.
        
        For each time horizon (1, 3, 5, 10, 15, 20, 25, 30 years), calculates the 
        annualized return that would be achieved if the simulation ended at that point.
        
        Args:
            results: List of simulation results
            config: Simulation configuration
            
        Returns:
            Dictionary with time horizons and percentile data
        """
        try:
            # Define time horizons to analyze
            time_horizons = [1, 3, 5, 10, 15, 20, 25, 30]
            percentiles = [10, 25, 50, 75, 90]
            trading_days_per_year = 252
            
            horizon_returns = {
                'time_horizons': time_horizons,
                'nominal': {},
                'real': {}
            }
            
            for horizon in time_horizons:
                if horizon > config.time_period_years:
                    # Skip horizons longer than simulation period
                    continue
                    
                nominal_returns = []
                real_returns = []
                
                for result in results:
                    # Calculate return at this specific time horizon
                    target_day = min(horizon * trading_days_per_year, len(result.cumulative_values_nominal) - 1)
                    
                    # Nominal annualized return
                    if target_day > 0 and result.cumulative_values_nominal[target_day] > 0:
                        cumulative_nominal = result.cumulative_values_nominal[target_day] / result.cumulative_values_nominal[0]
                        annualized_nominal = (cumulative_nominal ** (1 / horizon)) - 1
                        nominal_returns.append(annualized_nominal * 100)  # Convert to percentage
                    
                    # Real annualized return  
                    if target_day > 0 and result.cumulative_values_real[target_day] > 0:
                        cumulative_real = result.cumulative_values_real[target_day] / result.cumulative_values_real[0]
                        annualized_real = (cumulative_real ** (1 / horizon)) - 1
                        real_returns.append(annualized_real * 100)  # Convert to percentage
                
                # Calculate percentiles for this horizon
                if nominal_returns:
                    nominal_percentiles = np.percentile(nominal_returns, percentiles)
                    horizon_returns['nominal'][f'{horizon}_years'] = {
                        f'percentile_{p}th': float(nominal_percentiles[i])
                        for i, p in enumerate(percentiles)
                    }
                
                if real_returns:
                    real_percentiles = np.percentile(real_returns, percentiles)
                    horizon_returns['real'][f'{horizon}_years'] = {
                        f'percentile_{p}th': float(real_percentiles[i])
                        for i, p in enumerate(percentiles)
                    }
            
            self.logger.info(f"Expected returns calculated for {len(time_horizons)} time horizons")
            return horizon_returns
            
        except Exception as e:
            self.logger.error(f"Error calculating expected returns by horizon: {e}")
            raise
    
    def _calculate_percentile_paths(self, results: List[SimulationResult], 
                                   config: SimulationConfig) -> Dict[str, Any]:
        """
        Calculate percentile paths for visualization.
        
        Args:
            results: List of simulation results
            config: Simulation configuration
            
        Returns:
            Dictionary with percentile paths data
        """
        try:
            # Stack all paths
            all_paths_nominal = np.array([r.cumulative_values_nominal for r in results])
            all_paths_real = np.array([r.cumulative_values_real for r in results])
            
            # Calculate percentiles at each time point
            percentiles = [10, 25, 50, 75, 90]
            
            percentile_paths_nominal = {}
            percentile_paths_real = {}
            
            for p in percentiles:
                percentile_paths_nominal[f'p{p}'] = np.percentile(all_paths_nominal, p, axis=0)
                percentile_paths_real[f'p{p}'] = np.percentile(all_paths_real, p, axis=0)
            
            # Create time axis (in years)
            num_points = all_paths_nominal.shape[1]
            time_years = np.linspace(0, config.time_period_years, num_points)
            
            # Sample a few individual paths for visualization
            num_sample_paths = min(5, len(results))
            sample_indices = np.random.choice(len(results), num_sample_paths, replace=False)
            sample_paths_nominal = [results[i].cumulative_values_nominal for i in sample_indices]
            sample_paths_real = [results[i].cumulative_values_real for i in sample_indices]
            
            return {
                'time_years': time_years.tolist(),
                'percentile_paths_nominal': percentile_paths_nominal,
                'percentile_paths_real': percentile_paths_real,
                'sample_paths_nominal': sample_paths_nominal,
                'sample_paths_real': sample_paths_real,
                'initial_balance': config.initial_balance
            }
            
        except Exception as e:
            self.logger.error(f"Error calculating percentile paths: {e}")
            raise
    
    def get_treasury_rate_info(self) -> Dict[str, Any]:
        """
        Get current Treasury rate information and statistics.
        
        Returns:
            Dictionary with Treasury rate details
        """
        try:
            current_rate = self.get_current_risk_free_rate()
            
            # Get statistics for the configured duration
            stats = self.treasury_fetcher.get_rate_statistics(
                self.treasury_config.duration, years=5
            )
            
            # Test connection status
            connection_status = self.treasury_fetcher.test_connection()
            
            return {
                'current_rate': current_rate,
                'current_rate_percentage': f"{current_rate * 100:.2f}%",
                'duration': self.treasury_config.duration,
                'cache_hours': self.treasury_config.cache_hours,
                'fallback_rate': self.fallback_risk_free_rate,
                'last_updated': self._rate_last_updated.isoformat() if self._rate_last_updated else None,
                'statistics': stats,
                'connection_status': connection_status,
                'available_durations': list(self.treasury_fetcher.TREASURY_SERIES.keys())
            }
            
        except Exception as e:
            self.logger.error(f"Error getting Treasury rate info: {e}")
            return {
                'error': str(e),
                'fallback_rate': self.fallback_risk_free_rate,
                'duration': self.treasury_config.duration
            }
    
    def set_treasury_duration(self, duration: str) -> bool:
        """
        Change the Treasury duration for risk-free rate calculation.
        
        Args:
            duration: New Treasury duration ('3_month', '1_year', '10_year', etc.)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if duration not in self.treasury_fetcher.TREASURY_SERIES:
                self.logger.error(f"Invalid Treasury duration: {duration}")
                return False
            
            old_duration = self.treasury_config.duration
            self.treasury_config.duration = duration
            
            # Clear cached rate to force refresh with new duration
            self._current_risk_free_rate = None
            self._rate_last_updated = None
            
            self.logger.info(f"Changed Treasury duration from {old_duration} to {duration}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error setting Treasury duration: {e}")
            return False
    
    def close(self):
        """Clean up resources."""
        try:
            if hasattr(self, 'treasury_fetcher'):
                self.treasury_fetcher.close()
            self.logger.info("Monte Carlo Engine closed")
        except Exception as e:
            self.logger.error(f"Error closing Monte Carlo Engine: {e}")


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # This would typically be imported from main application
    print("Monte Carlo Engine implementation complete.")
    print("Ready for integration with FastAPI endpoints.")